const fs = require("node:fs"),
  vm = require("node:vm");
const context = { window: {} };
vm.runInNewContext(
  fs.readFileSync("config/production.example.js", "utf8"),
  context,
);
const production = context.window.LAYA_CONFIG;
function validate(c) {
  const f = c?.firebase;
  if (!f?.projectId) throw Error("Missing Firebase project");
  if (c.environment === "emulator") {
    if (
      !f.projectId.startsWith("demo-") ||
      !f.storageBucket?.startsWith(f.projectId + ".")
    )
      throw Error("Development must use demo project");
  } else if (c.environment === "staging") {
    if (
      !/^laya-[a-z0-9-]+-staging$/.test(f.projectId) ||
      f.storageBucket !== f.projectId + ".firebasestorage.app" ||
      f.authDomain !== f.projectId + ".firebaseapp.com" ||
      f.apiKey === production.firebase.apiKey ||
      f.appId === production.firebase.appId
    )
      throw Error("Staging/production boundary violation");
  } else if (c.environment === "production") {
    for (const [k, v] of Object.entries(production.firebase))
      if (f[k] !== v) throw Error("Production reference mismatch: " + k);
  } else throw Error("Unknown environment");
  return c.environment;
}
module.exports = { validate, production };
