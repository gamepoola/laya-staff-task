const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  cp = require("node:child_process");
for (const file of [
  "functions/index.js",
  "functions/domain.cjs",
  "functions/retention.cjs",
  "js/app.js",
  "js/firebase-init.js",
  "js/templates.js",
]) {
  const r = cp.spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
}
for (const file of [
  "firebase.json",
  "firestore.indexes.json",
  "manifest.json",
  "package.json",
  "functions/package.json",
])
  JSON.parse(fs.readFileSync(file));
const config = fs.readFileSync("js/firebase-config.js", "utf8");
assert.ok(config.includes("demo-laya-v4"));
assert.ok(!fs.existsSync("public/functions"));
assert.ok(!fs.existsSync("public/README.md"));
assert.ok(
  fs.readFileSync("functions/index.js", "utf8").includes("Asia/Bangkok"),
);
for (const file of ["staff", "manager", "upload", "checklist", "login"]) {
  const html = fs.readFileSync(file + ".html", "utf8");
  assert.ok(!/on(click|load|error)=/.test(html));
  assert.ok(html.includes("js/bundle.js"));
}
const template = fs.readFileSync("js/templates.js", "utf8");
assert.equal((template.match(/id:/g) || []).length, 53);
console.log(
  "PASS: syntax, config, 53 legacy checklist items, no inline event handlers, Hosting boundary and Bangkok retention schedule",
);
