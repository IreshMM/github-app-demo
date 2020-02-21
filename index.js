const EventEmitter = require('events');

class QualityGate extends EventEmitter { }

const qualityGate = new QualityGate();

const bodyParser = require('body-parser');
const rimraf = require("rimraf");
const dotenv = require("dotenv");
dotenv.config();
const simpleGit = require("simple-git")(process.env.WORKSPACE);

module.exports = app => {
    app.on("pull_request.opened", async context => {
        console.log(context.payload);
        await cleanWorkspace();
        await cloneCommit(context);
        startSonarQubeScan(context);
        setCommitStatus(context, 'pending');

        qualityGate.on('success', () => {
            setCommitStatus(context, 'success');
        });

        qualityGate.on('failure', () => {
            setCommitStatus(context, 'failure');
        });
    });

    const router = app.route("/");
    router.use(bodyParser.json());

    router.get("/s", (req, res) => {
        res.send("Hello Wordl");
    });

    router.post("/s", (req, res) => {
        updateQualityGateStatus(req.body);
        res.send("Success");
    });
};

function cleanWorkspace() {
    rimraf.sync(`${process.env.WORKSPACE}/*`);
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
        .execute(["clean", "install", "sonar:sonar"], { skipTests: true })
        .then(() => {
            console.log("done");
        });
}

function updateQualityGateStatus(payload) {
    const qualityGateStatus = payload.qualityGate.status;
    console.log(qualityGate);
    if (qualityGateStatus == 'OK') {
        qualityGate.emit('success');
    } else {
        qualityGate.emit('failure');
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

    payloadContext.github.repos.createStatus(payload);
}
