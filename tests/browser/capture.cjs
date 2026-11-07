// Fresh paths avoid Windows preview/file locks and retain evidence from each run.
const path = require("node:path");
const { test } = require("@playwright/test");
const root =
  process.env.LAYA_CAPTURE_ROOT ||
  path.join("docs", "test-captures", Date.now() + "-" + process.pid);
exports.capture = (page, options) =>
  page.screenshot({
    ...options,
    path: path.join(
      root,
      test.info().project.name,
      options.path.replace(/^docs[\\/]/, ""),
    ),
  });
