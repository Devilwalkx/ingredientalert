// Adds the build identity (version code, commit, build time) supplied by CI. Local builds are labelled "development".
const { expo } = require("./app.json");

module.exports = () => {
  const run = Number(process.env.GITHUB_RUN_NUMBER || 0);
  const commit = (process.env.BUILD_COMMIT || "local").slice(0, 7);
  return {
    ...expo,
    android: { ...expo.android, versionCode: run > 0 ? run : 1 },
    extra: { ...(expo.extra || {}), commit, builtAt: process.env.BUILD_TIME || "", channel: process.env.RELEASE_SIGNING === "1" ? "release" : run > 0 ? "ci-test-build" : "development" }
  };
};
