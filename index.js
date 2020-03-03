const getters = require("./getters");
const EventEmitter = require("events");

class QualityGate extends EventEmitter {}

const bodyParser = require("body-parser");
const rimraf = require("rimraf");
const dotenv = require("dotenv");
dotenv.config();
const simpleGit = require("simple-git")(process.env.WORKSPACE);

module.exports = app => {
  const qualityGate = new QualityGate();

  app.on("push", async context => {
    await cleanWorkspace(getters.getCommitSha(context.payload));
    await cloneCommit(context);
    startSonarQubeScan(context);
    setCommitStatus(context, "pending");

    const sha = getters.getCommitSha(context.payload);
    qualityGate.once(`${sha}_success`, () => {
      setCommitStatus(context, "success");
    });

    qualityGate.once(`${sha}_failure`, () => {
      setCommitStatus(context, "failure");
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

function cleanWorkspace(commitSha) {
  rimraf.sync(`${process.env.WORKSPACE}/${commitSha}`);
}

async function cloneCommit(context) {
  const cloneUrl = getters.getCloneUrl(context.payload);
  const branch = getters.getBranch(context.payload);
  const sha = getters.getCommitSha(context.payload);
  await simpleGit.clone(cloneUrl, sha, [
    "--single-branch",
    `--branch=${branch}`,
    "--depth=1"
  ]);
}

function startSonarQubeScan(context) {
  const commitSha = getters.getCommitSha(context.payload);
  const mvn = require("maven").create({
    cwd: `${process.env.WORKSPACE}/${commitSha}`
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
  if (qualityGateStatus == "OK") {
    console.log("inside OK");
    qualityGate.emit(`${sha}_success`);
  } else {
    console.log("inside FAILURE");
    qualityGate.emit(`${sha}_failure`);
  }
}

function setCommitStatus(payloadContext, commitStatus) {
  const owner = getters.getOwner(payloadContext.payload);
  const repo = getters.getRepoName(payloadContext.payload);
  const sha = getters.getCommitSha(payloadContext.payload);
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
