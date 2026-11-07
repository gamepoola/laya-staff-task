const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  home: "M3 10l9-7 9 7v11h-6v-7H9v7H3z",
  layers: "m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5",
  check: "M5 4h14v18H5zM9 2h6v4H9zM8 12l2 2 5-5M8 18h8",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-3a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 7",
  chart: "M4 20V12h3v8zM11 20V7h3v13zM18 20V2h3v18z",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  camera: "M3 6h5l2-3h4l2 3h5v15H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  leaf: "M12 22V8M12 15Q1 14 3 5q10 0 9 10M12 19q10-1 9-12-10 0-9 12M12 9Q7 3 12 0q5 4 0 9",
  arrow: "M5 12h14M14 7l5 5-5 5",
  award:
    "M8 15l-2 7 6-3 6 3-2-7M19 9a7 7 0 1 1-14 0 7 7 0 0 1 14 0M9 9l2 2 4-4",
  search: "M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  logout: "M10 3H3v18h7M8 12h14M17 7l5 5-5 5",
};
export function icon(name, cls = "") {
  return `<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.check}"/></svg>`;
}
export function ring(done, total, label = "") {
  const p = total > 0 ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
  return `<div class="progress-ring" role="img" aria-label="${esc(label)} ${total ? Math.round(p) + "%" : "—"}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" class="ring-track"/><circle cx="50" cy="50" r="40" class="ring-value" stroke-dasharray="${p * 2.513} 251.3"/></svg><b>${total ? Math.round(p) + "%" : "—"}</b></div>`;
}
export function kpis(items) {
  return items
    .map(
      ([label, n, detail], i) =>
        `<div class="stat tone-${i}"><div class="stat-label">${icon(["chart", "check", "award", "clock"][i])}<span>${esc(label)}</span></div><strong>${esc(n)}</strong><span class="stat-detail">${esc(detail || "")}</span><div class="stat-art">${i === 0 && String(n).includes("%") ? ring(parseFloat(n), 100, label) : icon(["chart", "check", "award", "clock"][i])}</div></div>`,
    )
    .join("");
}
export function emptyArt() {
  return `<div class="empty-art">${icon("leaf", "empty-leaf")}${icon("check")}</div>`;
}
export function enhance(root = document) {
  root.querySelectorAll(".empty").forEach((el) => {
    if (!el.querySelector("svg"))
      el.insertAdjacentHTML("afterbegin", emptyArt());
  });
  root.querySelectorAll("table").forEach((table) => {
    const labels = [...table.querySelectorAll("th")].map((x) => x.textContent);
    table
      .querySelectorAll("tbody tr")
      .forEach((row) =>
        [...row.children].forEach(
          (td, i) => (td.dataset.label = labels[i] || ""),
        ),
      );
  });
  root.querySelectorAll(".task-icon").forEach((el) => {
    if (/[✓☷↗▧]/.test(el.textContent))
      el.innerHTML = icon(el.textContent === "↗" ? "clock" : "check");
  });
}
export function setupShell(t) {
  const filter = document.querySelector("#filterForm");
  if (filter) {
    const details = document.createElement("details");
    details.className = "report-filters";
    const summary = document.createElement("summary");
    summary.textContent = t(
      "ช่วงวันที่และตัวกรองรายงาน",
      "Date range and report filters",
    );
    filter.before(details);
    details.append(summary, filter);
    const mq = matchMedia("(min-width: 700px)");
    details.open = mq.matches;
    mq.addEventListener("change", () => (details.open = mq.matches));
  }
  document
    .querySelector(".photo-picker")
    ?.insertAdjacentHTML("afterbegin", icon("camera"));
  document
    .querySelectorAll(".logo")
    .forEach((el) =>
      el.insertAdjacentHTML(
        "beforebegin",
        `<div class="brand-emblem">${icon("leaf")}</div>`,
      ),
    );
  document
    .querySelectorAll(".sidebar nav a")
    .forEach((a, i) =>
      a.insertAdjacentHTML(
        "afterbegin",
        icon(["home", "layers", "check", "arrow"][i]),
      ),
    );
  document
    .querySelectorAll("[data-tab]")
    .forEach((b, i) =>
      b.insertAdjacentHTML("afterbegin", icon(["chart", "check", "users"][i])),
    );
  document
    .querySelector("#logout")
    ?.insertAdjacentHTML("afterbegin", icon("logout"));
  document
    .querySelector(".topbar>div")
    ?.insertAdjacentHTML(
      "afterbegin",
      `<span class="profile-emblem">${icon("leaf")}</span>`,
    );
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    const toggle = document.createElement("button");
    toggle.className = "mobile-menu secondary";
    toggle.innerHTML = `${icon("layers")}<span data-th="เมนู" data-en="Menu">${t("เมนู", "Menu")}</span>`;
    sidebar.querySelector("nav").id = "primaryNavigation";
    toggle.setAttribute("aria-controls", "primaryNavigation");
    toggle.setAttribute("aria-expanded", "false");
    toggle.onclick = () => {
      const open = sidebar.classList.toggle("expanded");
      toggle.setAttribute("aria-expanded", String(open));
    };
    sidebar.querySelector("nav").before(toggle);
  }
  document
    .querySelectorAll(".intro")
    .forEach((el) =>
      el.insertAdjacentHTML(
        "beforeend",
        '<div class="hero-art" aria-hidden="true"></div>',
      ),
    );
  document
    .querySelectorAll("#export,#print,#refresh,#submitWork,#saveChecklist")
    .forEach((el) =>
      el.insertAdjacentHTML(
        "afterbegin",
        icon(
          el.id === "submitWork"
            ? "camera"
            : el.id === "refresh"
              ? "clock"
              : "check",
        ),
      ),
    );
  document.querySelectorAll(".tabs [role=tab]").forEach((el, i, all) => {
    el.setAttribute(
      "tabindex",
      el.getAttribute("aria-selected") === "true" ? "0" : "-1",
    );
    el.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const n =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? all.length - 1
            : (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
      all[n].click();
      all[n].focus();
    });
    el.addEventListener("click", () =>
      all.forEach((b) => (b.tabIndex = b === el ? 0 : -1)),
    );
  });
}
export function analytics(data, t) {
  const host = document.querySelector("#report");
  if (!host) return;
  const sum = data.daily.reduce(
    (a, d) => {
      ["assigned", "approved", "waiting", "overdue"].forEach(
        (k) => (a[k] += d[k]),
      );
      return a;
    },
    { assigned: 0, approved: 0, waiting: 0, overdue: 0 },
  );
  const max = Math.max(1, ...data.daily.map((d) => d.assigned));
  const bars = data.daily
    .map(
      (d) =>
        `<div class="chart-day"><svg viewBox="0 0 36 100" role="img" aria-label="${esc(d.date)}: ${d.approved}/${d.assigned}"><rect x="8" y="${95 - (d.assigned / max) * 85}" width="20" height="${(d.assigned / max) * 85}" rx="4" fill="#e4e8dc"/><rect x="8" y="${95 - (d.approved / max) * 85}" width="20" height="${(d.approved / max) * 85}" rx="4" fill="#438c63"/></svg><small>${esc(d.date.slice(5))}</small></div>`,
    )
    .join("");
  host.insertAdjacentHTML(
    "afterbegin",
    `<div class="report-visual"><div class="report-total">${ring(sum.approved, sum.assigned, t("อัตราสำเร็จ", "Completion"))}<div><b>${t("ความคืบหน้ารวม", "Overall progress")}</b><p><i class="legend-dot"></i>${t("อนุมัติแล้ว", "Approved")} <strong>${sum.approved}</strong></p><p><i class="legend-dot pending"></i>${t("รอตรวจ", "Pending review")} <strong>${sum.waiting}</strong></p><p class="small">${t("งานรายคนที่มอบหมาย", "Assigned staff-task-days")}: ${sum.assigned}</p></div></div><div class="daily-chart"><b>${t("ผลการปฏิบัติงานรายวัน", "Daily completion")}</b><div class="chart-bars">${bars}</div><small>${t("เขียว: อนุมัติ · สีอ่อน: มอบหมาย", "Green: approved · Light: assigned")}</small></div></div>`,
  );
  let attention = document.querySelector("#attention");
  if (!attention) {
    attention = document.createElement("div");
    attention.id = "attention";
    document.querySelector("#stats").after(attention);
  }
  attention.innerHTML = `${icon("clock")}<span>${t("สิ่งที่ต้องติดตาม", "Needs attention")} <b>${sum.waiting}</b> ${t("รอตรวจ", "pending")} · <b>${sum.overdue}</b> ${t("เกินกำหนด", "overdue")}</span><button class="secondary">${t("ไปที่งานส่งตรวจ", "View submissions")}${icon("arrow")}</button>`;
  attention.querySelector("button").onclick = () => {
    document.querySelector("[data-tab=review]").click();
    document.querySelector("#submissions").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const outlets = new Map();
  for (const day of data.daily)
    for (const r of day.rows) {
      const key = r.outlet || t("ไม่ระบุจุดบริการ", "Unspecified outlet"),
        o = outlets.get(key) || { assigned: 0, approved: 0, overdue: 0 };
      o.assigned += r.assigned;
      o.approved += r.approved;
      o.overdue += r.overdue;
      outlets.set(key, o);
    }
  host.insertAdjacentHTML(
    "beforeend",
    `<div class="outlet-overview"><h3>${t("ความพร้อมแต่ละจุดบริการ", "Outlet readiness")}</h3><div class="outlet-grid">${[...outlets].map(([name, o]) => `<div class="outlet-card"><b>${esc(name)}</b><progress max="${o.assigned || 1}" value="${o.approved}" aria-label="${esc(name)}"></progress><span>${o.approved}/${o.assigned} ${t("อนุมัติ", "approved")} · ${o.overdue} ${t("เกินกำหนด", "overdue")}</span></div>`).join("")}</div></div>`,
  );
  enhance(host);
  host.querySelectorAll(".chart-day").forEach((el, i) => {
    const value = document.createElement("span");
    value.className = "chart-value";
    value.textContent = `${data.daily[i].approved}/${data.daily[i].assigned}`;
    el.prepend(value);
  });
}
export function searchList(
  id,
  t,
  placeholder = t(
    "ค้นหาชื่อ แผนก หรือจุดบริการ…",
    "Search name, department or outlet…",
  ),
) {
  const list = document.getElementById(id);
  if (!list) return;
  let label = list.previousElementSibling;
  const apply = (input) => {
    const q = input.value.trim().toLowerCase();
    [...list.children].forEach(
      (el) => (el.hidden = !el.textContent.toLowerCase().includes(q)),
    );
  };
  if (!label?.classList.contains("list-search")) {
    label = document.createElement("label");
    label.className = "list-search";
    label.innerHTML = `${icon("search")}<input type="search">`;
    list.before(label);
    label
      .querySelector("input")
      .addEventListener("input", (e) => apply(e.target));
  }
  const input = label.querySelector("input");
  input.setAttribute("aria-label", t("ค้นหา", "Search"));
  input.placeholder = placeholder;
  apply(input);
}
export function ask(
  message,
  {
    text = false,
    detail = "",
    confirmLabel = "ยืนยัน / Confirm",
    danger = false,
  } = {},
) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "confirm-dialog";
    dlg.setAttribute("aria-labelledby", "decision-title");
    dlg.innerHTML = `${icon(text ? "check" : "award")}<h2 id="decision-title"></h2><p class="decision-context">${esc(detail)}</p>${text ? '<label>เหตุผลและสิ่งที่ต้องแก้ไข / Guidance<textarea maxlength="1000" required aria-describedby="decision-error" placeholder="ระบุจุดที่ต้องแก้ไขให้พนักงานทราบ"></textarea></label><p id="decision-error" role="alert"></p>' : ""}<div class="actions"><button class="secondary" data-cancel>ยกเลิก / Cancel</button><button data-ok>${esc(confirmLabel)}</button></div>`;
    dlg.querySelector("h2").textContent = message;
    if (danger) dlg.querySelector("[data-ok]").classList.add("danger");
    document.body.append(dlg);
    const finish = (value) => {
      dlg.close();
      dlg.remove();
      resolve(value);
    };
    dlg.querySelector("[data-cancel]").onclick = () =>
      finish(text ? null : false);
    dlg.querySelector("[data-ok]").onclick = () => {
      const value = text ? dlg.querySelector("textarea").value.trim() : true;
      if (text && !value) {
        dlg.querySelector("#decision-error").textContent =
          "กรุณาระบุเหตุผลก่อนส่ง / Please add guidance.";
        dlg.querySelector("textarea").focus();
        return;
      }
      finish(value);
    };
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(text ? null : false);
    });
    dlg.showModal();
    (
      dlg.querySelector("textarea") || dlg.querySelector("[data-cancel]")
    ).focus();
  });
}
