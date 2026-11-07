module.exports = {
  testDir: "tests/browser",
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5000",
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
      },
    ],
  ],
  projects: [
    {
      name: "Chromium",
      use: {
        browserName: "chromium",
      },
    },
    {
      name: "Edge",
      use: {
        browserName: "chromium",
        channel: "msedge",
      },
    },
  ],
};
