// Extends app.json. Push notifications on Android need Firebase: put the project's
// google-services.json next to this file and rebuild, and push switches on by itself
// (config.js reads extra.pushEnabled). Without the file the app builds and runs without push.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const firebase = fs.existsSync(path.join(__dirname, "google-services.json"));
  return {
    ...config,
    android: {
      ...config.android,
      ...(firebase ? { googleServicesFile: "./google-services.json" } : {}),
    },
    extra: { ...config.extra, pushEnabled: firebase },
  };
};
