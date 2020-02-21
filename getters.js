function getCommitSha(payload) {
  return payload.pull_request.head.sha;
}

function getBranch(payload) {
  const ref = getRef(payload);
  return ref.split("/")[2];
}

function getRef(payload) {
  return payload.ref;
}

function getCloneUrl(payload) {
  return payload.repository.clone_url;
}

function getRepoName(payload) {
  return payload.repository.name;
}

function getOwner(payload) {
  return payload.repository.owner;
}

module.exports = {
  getCommitSha,
  getBranch,
  getRef,
  getCloneUrl,
  getRepoName,
  getOwner
};
