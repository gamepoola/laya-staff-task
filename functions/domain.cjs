"use strict";
function day(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function applicable(t, p, uid, date) {
  if (t.active === false || p.active === false) return false;
  if ((t.shift && t.shift !== p.shift) || (t.outlet && t.outlet !== p.outlet))
    return false;
  const target =
    t.assignedTo === "all" ||
    t.assignedTo === uid ||
    (t.assignedTo === "department" &&
      !!p.department &&
      t.department === p.department) ||
    (t.assignedTo === "outlet" && !!p.outlet && t.outlet === p.outlet);
  if (!target) return false;
  const recurrence = t.recurrence || (t.forDate ? "once" : "daily");
  if (recurrence === "once") return t.forDate === date;
  if ((t.forDate && t.forDate > date) || (t.endDate && date > t.endDate))
    return false;
  return (
    recurrence !== "weekly" ||
    (t.weekdays || []).includes(new Date(date + "T12:00:00+07:00").getUTCDay())
  );
}
function points(priority) {
  return (
    { normal: 1, high: 2, critical: 3 }[
      String(priority || "Normal").toLowerCase()
    ] || 1
  );
}
function publicProfile(p) {
  const result = {};
  for (const k of [
    "staffID",
    "name",
    "position",
    "department",
    "outlet",
    "shift",
    "role",
    "points",
    "active",
  ])
    if (p[k] !== undefined) result[k] = p[k];
  return result;
}
function metrics(tasks, staff, submissions, date, now = new Date()) {
  const rows = [];
  let assigned = 0,
    approved = 0,
    submitted = 0,
    overdue = 0;
  for (const p of staff.filter(
    (s) => s.role !== "manager" && s.active !== false,
  )) {
    const jobs = tasks.filter((t) => applicable(t, p, p.id, date));
    const row = {
      id: p.id,
      name: p.name,
      department: p.department || "",
      outlet: p.outlet || "",
      assigned: jobs.length,
      submitted: 0,
      approved: 0,
      overdue: 0,
    };
    for (const t of jobs) {
      const s = submissions.find(
        (s) => s.staffUid === p.id && s.taskId === t.id && s.date === date,
      );
      if (s && ["waiting", "approved"].includes(s.status)) row.submitted++;
      if (s?.status === "approved") row.approved++;
      if (
        t.dueTime &&
        new Date(date + "T" + t.dueTime + ":00+07:00") < now &&
        s?.status !== "approved"
      )
        row.overdue++;
    }
    row.missing = row.assigned - row.submitted;
    assigned += row.assigned;
    approved += row.approved;
    submitted += row.submitted;
    overdue += row.overdue;
    rows.push(row);
  }
  return {
    assigned,
    approved,
    submitted,
    overdue,
    waiting: submissions.filter((s) => s.status === "waiting").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
    completionRate: assigned ? approved / assigned : null,
    rejectionRate: submissions.length
      ? submissions.filter((s) => s.status === "rejected").length /
        submissions.length
      : null,
    rows,
  };
}
module.exports = { day, applicable, points, publicProfile, metrics };
