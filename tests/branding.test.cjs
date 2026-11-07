const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  E = require("../tools/environment.cjs");
test("FB Staff APP manifest, pages and Android icons are complete", async () => {
  const m = JSON.parse(fs.readFileSync("manifest.json"));
  assert.equal(m.name, "FB Staff APP");
  assert.equal(m.short_name, "FB Staff APP");
  for (const route of [
    "login",
    "staff",
    "manager",
    "upload",
    "checklist",
    "index",
  ]) {
    const h = fs.readFileSync(route + ".html", "utf8");
    assert.ok(h.includes("FB Staff APP"));
    assert.ok(!h.includes(">LAYA<"));
  }
  for (const i of m.icons) {
    const meta = await require("../functions/node_modules/sharp")(
      i.src,
    ).metadata();
    assert.equal(`${meta.width}x${meta.height}`, i.sizes);
    assert.ok(!meta.hasAlpha);
  }
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
});
test("development, staging and exact production reference stay separated", () => {
  const p = JSON.parse(JSON.stringify(E.production));
  assert.equal(E.validate(p), "production");
  assert.equal(p.firebase.projectId, "laya-staff-task-us");
  assert.throws(() => E.validate({ ...p, environment: "staging" }));
  assert.throws(() => E.validate({ ...p, environment: "emulator" }));
  assert.throws(() =>
    E.validate({
      ...p,
      firebase: { ...p.firebase, projectId: "fb-staff-app" },
    }),
  );
  assert.equal(
    E.validate({
      environment: "emulator",
      firebase: {
        projectId: "demo-laya-v4",
        storageBucket: "demo-laya-v4.firebasestorage.app",
      },
    }),
    "emulator",
  );
  const s = {
    environment: "staging",
    firebase: {
      projectId: "laya-example-staging",
      authDomain: "laya-example-staging.firebaseapp.com",
      storageBucket: "laya-example-staging.firebasestorage.app",
      apiKey: "synthetic",
      appId: "synthetic",
    },
  };
  assert.equal(E.validate(s), "staging");
  assert.throws(() =>
    E.validate({
      ...s,
      firebase: { ...s.firebase, apiKey: p.firebase.apiKey },
    }),
  );
});
