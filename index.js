const dotenv = require("dotenv");
dotenv.config();
const simpleGit = require("simple-git")(process.env.WORKSPACE);

module.exports = app => {
  app.on("pull_request.opened", async context => {
    console.log(context.payload);
    cloneCommit(context);
    startSonarQubeScan(context);
    updatePendingStatus(context);
  });

  const router = app.route("/my-app");

  router.get("/hello-world", (req, res) => {
    res.send("Hello Wordl");
  });
};

function cloneCommit(context) {
  const cloneUrl = context.payload.pull_request.base.repo.clone_url;
  const ref = context.payload.pull_request.head.ref;
  simpleGit
    .clone(cloneUrl, ["--single-branch", `--branch=${ref}`, "--depth=1"])
    .then(() => console.log("done cloning"));
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

function updatePendingStatus(payloadContext) {
  const owner = payloadContext.payload.pull_request.head.repo.owner.login;
  const repo = payloadContext.payload.pull_request.head.repo.name;
  const sha = payloadContext.payload.pull_request.head.sha;
  const state = "pending";
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
