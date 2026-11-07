// Writes an isolated local deployment artifact. Never creates cloud resources or deploys.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
function validate(c) {
  require("./environment.cjs").validate(c);
  const p = c?.firebase?.projectId,
    b = c?.firebase?.storageBucket;
  if (
    c.environment !== "staging" ||
    !/^laya-[a-z0-9-]+-staging$/.test(p || "") ||
    p === "laya-staff-task-us" ||
    !b?.startsWith(p + ".") ||
    c.region !== "us-central1" ||
    !c.appCheckSiteKey ||
    /REPLACE|PLACEHOLDER/.test(JSON.stringify(c))
  )
    throw Error(
      "Reviewed staging-only config required: laya-…-staging, matching bucket, region, App Check key",
    );
  for (const name of ["apiKey", "authDomain", "appId"])
    if (!c.firebase[name]) throw Error("Missing " + name);
  if (c.firebase.authDomain !== p + ".firebaseapp.com")
    throw Error("Cross-project Auth domain refused");
  return p;
}
function prepare(configFile, output) {
  const c = JSON.parse(fs.readFileSync(configFile)),
    project = validate(c),
    out = path.resolve(output);
  if (fs.existsSync(out)) throw Error("Output exists; preserve prior artifact");
  fs.mkdirSync(out, { recursive: true });
  for (const entry of [
    "public",
    "functions",
    "firebase-rules",
    "firestore.indexes.json",
  ])
    fs.cpSync(entry, path.join(out, entry), {
      recursive: true,
      filter: (s) =>
        !s.split(path.sep).includes("node_modules") &&
        !path.basename(s).startsWith(".env"),
    });
  fs.writeFileSync(
    path.join(out, "public/js/firebase-config.js"),
    "window.LAYA_CONFIG=" + JSON.stringify(c) + ";",
  );
  const sw = path.join(out, "public/sw.js"),
    stageHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(sw))
      .update(JSON.stringify(c))
      .digest("hex")
      .slice(0, 12);
  fs.writeFileSync(
    sw,
    fs
      .readFileSync(sw, "utf8")
      .replace(/laya-v4-[a-f0-9]{12}/, "laya-v4-" + stageHash),
  );
  const f = JSON.parse(fs.readFileSync("firebase.json"));
  delete f.emulators;
  for (const h of f.hosting.headers[0].headers)
    if (h.key === "Content-Security-Policy")
      h.value = h.value.replace(
        / (?:http|ws):\/\/(?:127\.0\.0\.1|localhost):\*/g,
        "",
      );
  fs.writeFileSync(path.join(out, "firebase.json"), JSON.stringify(f, null, 2));
  fs.writeFileSync(
    path.join(out, ".firebaserc"),
    JSON.stringify({ projects: { default: project } }),
  );
  fs.writeFileSync(
    path.join(out, "functions/.env." + project),
    `EVIDENCE_BUCKET=${c.firebase.storageBucket}\nENFORCE_APP_CHECK=true\nCLEANUP_MODE=dry-run\nRETENTION_BUCKET_REVIEWED=false\n`,
  );
  fs.writeFileSync(
    path.join(out, "TARGET_REQUIRES_APPROVAL.json"),
    JSON.stringify(
      {
        project,
        environment: "staging",
        deployed: false,
        billingApproved: false,
        cleanup: "dry-run",
        configurationSHA256: crypto
          .createHash("sha256")
          .update(JSON.stringify(c))
          .digest("hex"),
      },
      null,
      2,
    ),
  );
  return out;
}
module.exports = { validate, prepare };
if (require.main === module) {
  if (process.argv.length !== 4)
    throw Error(
      "Usage: node tools/prepare-staging.cjs reviewed-config.json NEW-output-directory",
    );
  console.log(prepare(process.argv[2], process.argv[3]));
}
