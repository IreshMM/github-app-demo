const EventEmitter = require('events');

class QualityGate extends EventEmitter {}

const bodyParser = require('body-parser');
const rimraf = require("rimraf");
const dotenv = require("dotenv");
dotenv.config();
const simpleGit = require("simple-git")(process.env.WORKSPACE);

module.exports = app => {
	const qualityGate = new QualityGate();

	app.on("pull_request.opened", async context => {
		await cleanWorkspace();
		await cloneCommit(context);
		startSonarQubeScan(context);
		setCommitStatus(context, 'pending');

		qualityGate.once(`${getCommitSha(context)}_success`, () => {
			setCommitStatus(context, 'success');
		});

		qualityGate.once(`${getCommitSha(context)}_failure`, () => {
			setCommitStatus(context, 'failure');
		});
	});

	const router = app.route("/");
	router.use(bodyParser.json());

	router.get("/s", (req, res) => {
		res.send("Hello Wordl");
	});

	router.post("/s", (req, res) => {
		updateQualityGateStatus(req.body, qualityGate);
		res.send("Success");
	});
};

function cleanWorkspace() {
	rimraf.sync(`${process.env.WORKSPACE}/*`);
}

function getCommitSha(context) {
	return context.payload.pull_request.head.sha;
}

async function cloneCommit(context) {
	const cloneUrl = context.payload.pull_request.base.repo.clone_url;
	const ref = context.payload.pull_request.head.ref;
	await simpleGit.clone(cloneUrl, [
		"--single-branch",
		`--branch=${ref}`,
		"--depth=1"
	]);
}

function startSonarQubeScan(context) {
	const repoName = context.payload.pull_request.base.repo.name;
	const mvn = require("maven").create({
		cwd: `${process.env.WORKSPACE}/${repoName}`
	});

	mvn
		.execute(["clean", "install", "sonar:sonar"], {skipTests: true})
		.then(() => {
			console.log("done");
		});
}

function updateQualityGateStatus(payload, qualityGate) {
	console.log(payload);
	const sha = payload.revision;
	const qualityGateStatus = payload.qualityGate.status;
	if (qualityGateStatus == 'OK') {
		console.log("inside OK");
		qualityGate.emit(`${sha}_success`);
	} else {
		console.log("inside FAILURE");
		qualityGate.emit(`${sha}_failure`);
	}
}

function setCommitStatus(payloadContext, commitStatus) {
	const owner = payloadContext.payload.pull_request.head.repo.owner.login;
	const repo = payloadContext.payload.pull_request.head.repo.name;
	const sha = payloadContext.payload.pull_request.head.sha;
	const state = commitStatus;
	const description = "CI Test - Check quality of code";
	const context = "SonarQube Quality Gate";

	const payload = {
		owner,
		repo,
		sha,
		state,
		description,
		context
	};

	console.log(payload);
	payloadContext.github.repos.createStatus(payload);
}
