const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  B = require("../tools/records-backup.cjs");
test("backup encoding preserves application maps that resemble codec markers or references", () => {
  const input = {
    settings: { $type: "timestamp", seconds: 12, nanoseconds: 34 },
    custom: { path: "business/path", firestore: "user field" },
    nested: [{ normal: true }],
    nonfinite: NaN,
  };
  const output = B.decode(B.encode(input), {
    doc: () => {
      throw Error("Plain maps must not become references");
    },
  });
  assert.deepEqual(output, input);
});
