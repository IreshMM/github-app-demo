function getCommitSha(payload) {
  return payload.head_commit.id;
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
  return payload.repository.owner.name;
}

module.exports = {
  getCommitSha,
  getBranch,
  getRef,
  getCloneUrl,
  getRepoName,
  getOwner
};
