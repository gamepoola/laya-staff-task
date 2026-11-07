const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  D = require("../functions/domain.cjs");
const p = {
  id: "a",
  department: "FB",
  outlet: "The Taste",
  shift: "Morning",
  role: "staff",
};
test("Bangkok date boundary", () => {
  assert.equal(D.day(new Date("2026-11-05T18:00:00Z")), "2026-11-06");
});
test("legacy forDate respected; undated tasks remain daily", () => {
  assert.equal(
    D.applicable(
      { assignedTo: "all", forDate: "2026-11-05" },
      p,
      "a",
      "2026-11-06",
    ),
    false,
  );
  assert.equal(D.applicable({ assignedTo: "all" }, p, "a", "2026-11-06"), true);
});
test("department, outlet, shift, weekly and disabled access", () => {
  const task = {
    assignedTo: "department",
    department: "FB",
    outlet: "The Taste",
    shift: "Morning",
    recurrence: "weekly",
    weekdays: [5],
    active: true,
  };
  assert.ok(D.applicable(task, p, "a", "2026-11-06"));
  for (const fields of [
    { department: "HK" },
    { outlet: "Banquet" },
    { shift: "Afternoon" },
    { active: false },
  ])
    assert.equal(
      D.applicable(task, { ...p, ...fields }, "a", "2026-11-06"),
      false,
    );
  assert.equal(D.applicable(task, p, "a", "2026-11-07"), false);
});
test("metrics count only applicable task/employee intersection and approval", () => {
  const tasks = [
      { id: "x", assignedTo: "a", active: true },
      { id: "y", assignedTo: "other", active: true },
    ],
    subs = [
      { staffUid: "a", taskId: "x", date: "2026-11-06", status: "rejected" },
      { staffUid: "a", taskId: "y", date: "2026-11-06", status: "approved" },
    ],
    m = D.metrics(tasks, [p], subs, "2026-11-06");
  assert.equal(m.assigned, 1);
  assert.equal(m.approved, 0);
  assert.equal(m.submitted, 0);
  assert.equal(m.rows[0].missing, 1);
  assert.equal(m.completionRate, 0);
  assert.equal(D.metrics([], [], [], "2026-11-06").completionRate, null);
});
test("priority points and sanitized profile", () => {
  assert.deepEqual(["Normal", "High", "Critical"].map(D.points), [1, 2, 3]);
  assert.deepEqual(
    D.publicProfile({
      name: "A",
      points: 5,
      sharedLeaderboard: [{ private: "data" }],
      secret: "hidden",
    }),
    { name: "A", points: 5 },
  );
});
