const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
process.chdir(root);
fs.mkdirSync("public/js", { recursive: true });
const cfg = fs.readFileSync("js/firebase-config.js", "utf8");
const configContext = { window: {} };
require("node:vm").runInNewContext(cfg, configContext, { timeout: 1000 });
const runtimeConfig = configContext.window.LAYA_CONFIG;
require("./environment.cjs").validate(runtimeConfig);
if (
  process.env.LAYA_RELEASE === "true" &&
  process.env.LAYA_APPROVED_PROJECT !== runtimeConfig.firebase.projectId
)
  throw Error("Release requires exact LAYA_APPROVED_PROJECT");
if (
  process.env.LAYA_RELEASE === "true" &&
  (runtimeConfig?.environment === "emulator" ||
    runtimeConfig?.firebase?.projectId?.startsWith("demo-"))
)
  throw Error("Release requires reviewed staging/production configuration");
for (const dir of ["css", "assets", "icons"])
  fs.cpSync(dir, "public/" + dir, { recursive: true });
for (const f of [
  "index.html",
  "login.html",
  "staff.html",
  "manager.html",
  "upload.html",
  "checklist.html",
  "manifest.json",
  "sw.js",
])
  fs.copyFileSync(f, "public/" + f);
fs.copyFileSync("js/firebase-config.js", "public/js/firebase-config.js");
require("esbuild").buildSync({
  entryPoints: ["js/app.js"],
  bundle: true,
  outfile: "public/js/bundle.js",
  format: "esm",
  target: ["chrome100", "edge100"],
  minify: true,
  legalComments: "eof",
});
const crypto = require("node:crypto");
let sw = fs.readFileSync("public/sw.js", "utf8");
const hash = crypto
  .createHash("sha256")
  .update(fs.readFileSync("public/js/bundle.js"))
  .update(fs.readFileSync("css/style.css"))
  .update(fs.readFileSync("css/premium.css"))
  .update(fs.readFileSync("assets/resort.svg"))
  .update(cfg)
  .update(fs.readFileSync("manifest.json"))
  .update(fs.readFileSync("assets/app-icon.svg"))
  .digest("hex")
  .slice(0, 12);
sw = sw.replace("BUILD_HASH", hash);
fs.writeFileSync("public/sw.js", sw);
console.log("Built public/; service worker version " + hash);
