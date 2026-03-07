// Manager Daily Checklist — The Taste (Morning shift)

// Manager Daily Checklist — The Taste / The Mangrove (Morning / Afternoon)

const BASE_SECTIONS_V1 = [
  { title: "1) Entrance and Hostess stand", items: [
    { id: "1.1", text: "Cleanliness Entrance and Hostess stand. / ความสะอาดทางเข้าและจุดต้อนรับ" },
    { id: "1.2", text: "Hostess counter is clean and not dirty. / เคาน์เตอร์พนักงานต้อนรับสะอาด ไม่สกปรก" }
  ]},
  { title: "2) Lighting / Air condition", items: [
    { id: "2.1", text: "Turn on the lights in the restaurant and check that the electricity is working. / เปิดไฟในร้านอาหารและตรวจสอบว่าไฟฟ้าใช้งานได้" },
    { id: "2.2", text: "Air condition hole no dusty. / แอร์ไม่มีฝุ่น" },
    { id: "2.3", text: "Air condition temperature. / อุณหภูมิของเครื่องปรับอากาศ" }
  ]},
  { title: "3) Check staff grooming", items: [
    { id: "3.1", text: "Clean, well-ironed, and complete uniform / เครื่องแบบสะอาด รีดเรียบ และครบชุด" },
    { id: "3.2", text: "Name tag visible and properly placed / ป้ายชื่ออยู่ในตำแหน่งที่ถูกต้องและมองเห็นได้ชัด" },
    { id: "3.3", text: "Daily shower, fresh breath, and good personal hygiene / อาบน้ำทุกวัน กลิ่นปากสดชื่น สุขอนามัยส่วนบุคคลดี" },
    { id: "3.4", text: "Short, neat, and well-groomed hair / ผมสั้นเรียบร้อย ตัดแต่งดูดี" },
    { id: "3.5", text: "Hair tied back neatly or in a bun, no loose hair / ผมรวบเรียบร้อยหรือเก็บเป็นมวย ไม่ปล่อยรุ่ย" },
    { id: "3.6", text: "Short, clean, and without colored nail polish / เล็บสั้น สะอาด และไม่มีสีทาเล็บ" },
    { id: "3.7", text: "Hands clean and free from cuts or wounds / มือสะอาด ไม่มีแผลหรือบาดเจ็บ" },
    { id: "3.8", text: "Minimal or no jewelry (only wedding band allowed) / เครื่องประดับให้น้อยที่สุด (อนุญาตเฉพาะแหวนแต่งงาน)" },
    { id: "3.9", text: "Clean, polished, and appropriate for work shoes / รองเท้าเรียบร้อย สะอาด และเหมาะสมกับงาน" },
    { id: "3.10", text: "Clean-shaven or neatly trimmed beard/moustache / โกนหนวดเคราเกลี้ยงเกลา หรือไว้ให้เรียบร้อย" },
    { id: "3.11", text: "No visible tattoos or inappropriate accessories / ไม่มีรอยสักที่เห็นได้ชัด หรืออุปกรณ์ที่ไม่เหมาะสม" }
  ]},
  { title: "4) Staff briefing / ประชุมพนักงาน", items: [
    { id: "4.1", text: "5–10 minute staff meeting to divide up duties before starting work. / ประชุมพนักงาน 5–10 นาทีเพื่อแบ่งหน้าที่ก่อนเริ่มงาน" }
  ]},
  { title: "5) Cashier Counter / เคาน์เตอร์แคชเชียร์", items: [
    { id: "5.1", text: "Open and check POS computer (no dusty) and ready to work. / เปิดเช็คเครื่อง POS พร้อมทำงาน" },
    { id: "5.2", text: "Check stationary printer ready and match to work. / ตรวจสอบเครื่องพิมพ์ให้พร้อมใช้และใช้งานได้อย่างถูกต้อง" },
    { id: "5.3", text: "Check EDC machine terminal work promptly. / ตรวจสอบเครื่อง EDC" },
    { id: "5.4", text: "Check guest breakfast and number of guests. / ตรวจสอบอาหารเช้าและจำนวนแขก" },
    { id: "5.5", text: "Count the money for change. / นับเงินทอน" },
    { id: "5.6", text: "Cashier counter is clean and not dirty. / เคาน์เตอร์แคชเชียร์สะอาด ไม่สกปรก" },
    { id: "5.7", text: "Check guest’s check bill. / เช็คบิลของแขก" }
  ]},
  { title: "6) Prepare things for breakfast (Inside Restaurant)", items: [
    { id: "6.1", text: "Coffee machine is clean and ready to work. / เครื่องชงกาแฟสะอาดพร้อมใช้งาน" },
    { id: "6.2", text: "Water heater is clean and ready to use. / เครื่องทำน้ำร้อนพร้อมใช้งาน" },
    { id: "6.3", text: "Tea cups, coffee cups, spoons are clean and ready. / แก้วชา กาแฟ ช้อนชา-กาแฟ สะอาด" },
    { id: "6.4", text: "Prepare various fruit juices and milk. / เตรียมนมและน้ำผลไม้ให้เพียงพอ" },
    { id: "6.5", text: "Food name tag clean, no stains, letters clear. / ป้ายอาหารสะอาด ไม่มีรอยเปื้อน ตัวอักษรชัดเจน" },
    { id: "6.6", text: "Buffet aisle floor clean and free of food scraps. / พื้นทางเดินบุฟเฟต์สะอาด ไม่มีเศษอาหาร" },
    { id: "6.7", text: "Tray stand at each point. / มีที่วางถาดประจำจุด" },
    { id: "6.8", text: "Table cleaning solution available. / มีน้ำยาทำความสะอาดโต๊ะ" },
    { id: "6.9", text: "Silverware tidy and clean. / เครื่องมือสะอาดเรียบร้อย" }
  ]},
  { title: "7) Check cleanliness (Inside/Outside)", items: [
    { id: "7.1", text: "Cleanliness of chairs and tables. / ความสะอาดของโต๊ะและเก้าอี้" },
    { id: "7.2", text: "Cleanliness of salt and pepper shakers. / ความสะอาดของขวดเกลือและพริกไทย" },
    { id: "7.3", text: "Cleanliness of placemats. / ความสะอาดของแผ่นรองจาน" },
    { id: "7.4", text: "Clean cutlery and knife rack. / ชั้นวางช้อนส้อมมีดสะอาด" },
    { id: "7.5", text: "The floor is dry and clean. / พื้นแห้งและสะอาด" },
    { id: "7.6", text: "The table cloth must not be dirty. / ผ้าเช็คโต๊ะต้องสะอาด ไม่สกปรก" },
    { id: "7.7", text: "Check service stations. / เช็คพนักงานประจำจุด" },
    { id: "7.8", text: "Table set up. / การเซ็ตอัพหน้าโต๊ะ" }
  ]},
  { title: "8) Area outside the restaurant / บริเวณด้านนอกร้านอาหาร", items: [
    { id: "8.1", text: "Place the cushion in the designated position. / วางเบาะในตำแหน่งที่กำหนด" },
    { id: "8.2", text: "Open umbrella next to swimming pool. / เปิดร่มข้างสระว่ายน้ำ" },
    { id: "8.3", text: "Ashtrays placed at designated points. / มีที่เขี่ยบุหรี่วางไว้ตามจุดที่กำหนด" },
    { id: "8.4", text: "Cushion is clean and free of stains. / เบาะสะอาดไม่มีรอยเปื้อน" },
    { id: "8.5", text: "There Hostess in front of the restaurant. / มีพนักงานต้อนรับด้านหน้าห้องอาหาร" }
  ]},
  { title: "9) Breakfast Closing", items: [
    { id: "9.1", text: "Clear tableware, glasses, cutlery / เก็บอุปกรณ์บนโต๊ะ เช่น แก้ว ช้อน ส้อม" },
    { id: "9.2", text: "Switch off all lights and electrical equipment / ปิดไฟและอุปกรณ์ไฟฟ้าทุกชนิด" },
    { id: "9.3", text: "Turn off coffee machines / ปิดเครื่องกาแฟ" },
    { id: "9.4", text: "Store ingredients neatly / จัดเก็บส่วนผสมอย่างเรียบร้อย" },
    { id: "9.5", text: "Secure all doors and windows / ปิดประตูหน้าต่างให้เรียบร้อย" },
    { id: "9.6", text: "General inspection of the area / ตรวจสอบความเรียบร้อยทั่วไป" },
    { id: "9.7", text: "Clean and prepare equipment for the next day / ทำความสะอาดและเตรียมอุปกรณ์สำหรับวันถัดไป" }
  ]}
];

const CHECKLIST_TEMPLATES = {
  // Using the same checklist items for both outlets/shifts as v1 template.
  // You can customize per outlet/shift later by editing BASE_SECTIONS_V1 or adding new sections.
  "The Taste|Morning|v1": { outlet: "The Taste", shift: "Morning", version: 1, sections: BASE_SECTIONS_V1 },
  "The Taste|Afternoon|v1": { outlet: "The Taste", shift: "Afternoon", version: 1, sections: BASE_SECTIONS_V1 },
  "The Mangrove|Morning|v1": { outlet: "The Mangrove", shift: "Morning", version: 1, sections: BASE_SECTIONS_V1 },
  "The Mangrove|Afternoon|v1": { outlet: "The Mangrove", shift: "Afternoon", version: 1, sections: BASE_SECTIONS_V1 }
};

function templateKey(outlet, shift){ return `${outlet}|${shift}|v1`; }

function checklistDocId(outlet, dateStr, shift){
  const o = String(outlet || "").replaceAll(/\s+/g, "_");
  const d = String(dateStr || "").replaceAll(/[^0-9\-]/g, "");
  const s = String(shift || "").replaceAll(/\s+/g, "_");
  return `${o}_${d}_${s}`;
}

function cloneTemplate(tpl){
  return {
    outlet: tpl.outlet,
    shift: tpl.shift,
    version: tpl.version,
    note: "",
    checkedBy: "",
    sections: tpl.sections.map(sec => ({
      title: sec.title,
      items: sec.items.map(it => ({
        id: it.id,
        text: it.text,
        done: false,
        remark: "",
        actionBy: ""
      }))
    }))
  };
}

const ACTION_BY_OPTIONS = ["", "K.Too", "K.Noi", "K.Parawee", "K.Joy"];

function actionBySelectHtml(id, current){
  const cur = String(current || "");
  return `
    <select id="${id}">
      ${ACTION_BY_OPTIONS.map(v => `<option value="${v}" ${v===cur ? "selected":""}>${v || "-"}</option>`).join("")}
    </select>
  `;
}

async function loadChecklistPage(){
  const user = await requireAuth();
  const profile = await getProfile(user.uid);
  if(profile?.role !== "manager"){
    toast("หน้านี้สำหรับ Manager เท่านั้น", "danger");
    window.location.href="staff.html";
    return;
  }

  el("clDate").value = todayStr();
  el("clCheckedBy").value = profile?.name || "Manager";

  el("clLoadBtn").onclick = loadChecklist;
  el("clSaveBtn").onclick = saveChecklist;
  el("clMarkAllBtn").onclick = markAllDone;
  el("clPrintBtn").onclick = () => window.print();

  // auto load when selecting outlet/shift/date
  el("clShift").addEventListener("change", loadChecklist);
  el("clOutlet").addEventListener("change", loadChecklist);
  el("clDate").addEventListener("change", loadChecklist);

  await loadChecklist();
}

function renderChecklist(model){
  const container = el("clContainer");
  container.innerHTML = "";

  for(const sec of model.sections){
    const secDiv = document.createElement("div");
    secDiv.className = "card";
    secDiv.style.marginBottom = "12px";

    secDiv.innerHTML = `
      <h3 style="margin:0 0 8px 0;">${escapeHtml(sec.title)}</h3>
      <table class="table">
        <thead>
          <tr>
            <th style="width:70px;">Done</th>
            <th>Task</th>
            <th style="width:280px;">Remark</th>
            <th style="width:180px;">Action By</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;

    const tbody = secDiv.querySelector("tbody");

    for(const it of sec.items){
      const rid = `remark_${it.id}`.replaceAll(".","_");
      const aid = `action_${it.id}`.replaceAll(".","_");
      const cid = `check_${it.id}`.replaceAll(".","_");

      tbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td><input type="checkbox" id="${cid}" ${it.done ? "checked":""} /></td>
          <td><b>${escapeHtml(it.id)}</b> — ${escapeHtml(it.text)}</td>
          <td><input id="${rid}" placeholder="Remark / Note" value="${escapeHtml(it.remark || "")}" /></td>
          <td>${actionBySelectHtml(aid, it.actionBy)}</td>
        </tr>
      `);
    }

    container.appendChild(secDiv);
  }
}

function collectChecklistFromUI(model){
  for(const sec of model.sections){
    for(const it of sec.items){
      const rid = `remark_${it.id}`.replaceAll(".","_");
      const aid = `action_${it.id}`.replaceAll(".","_");
      const cid = `check_${it.id}`.replaceAll(".","_");
      it.done = !!(document.getElementById(cid)?.checked);
      it.remark = document.getElementById(rid)?.value || "";
      it.actionBy = document.getElementById(aid)?.value || "";
    }
  }
  model.note = el("clNote").value || "";
  model.checkedBy = el("clCheckedBy").value || "";
  return model;
}

async function loadChecklist(){
  const outlet = el("clOutlet").value;
  const shift = el("clShift").value;
  const dateStr = el("clDate").value || todayStr();

  const key = templateKey(outlet, shift);
  const tpl = CHECKLIST_TEMPLATES[key];
  if(!tpl){
    toast("ไม่พบ template checklist", "danger");
    return;
  }

  const docId = checklistDocId(outlet, dateStr, shift);
  const ref = db().collection("manager_checklists").doc(docId);

  try{
    const snap = await ref.get();
    if(snap.exists){
      const data = snap.data() || {};
      el("clNote").value = data.note || "";
      el("clCheckedBy").value = data.checkedBy || el("clCheckedBy").value;
      const model = cloneTemplate(tpl);
      if (Array.isArray(data.sections)) model.sections = data.sections;
      renderChecklist(model);
      toast("โหลด checklist จากระบบแล้ว ✅", "info");
    }else{
      el("clNote").value = "";
      renderChecklist(cloneTemplate(tpl));
      toast("ยังไม่มี checklist วันนี้ — สร้างแบบฟอร์มใหม่แล้ว", "info");
    }
  }catch(e){
    console.error(e);
    toast("โหลด checklist ไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}

async function saveChecklist(){
  const user = await requireAuth();
  const profile = await getProfile(user.uid);

  const outlet = el("clOutlet").value;
  const shift = el("clShift").value;
  const dateStr = el("clDate").value || todayStr();
  const key = templateKey(outlet, shift);
  const tpl = CHECKLIST_TEMPLATES[key];
  const docId = checklistDocId(outlet, dateStr, shift);

  const model = cloneTemplate(tpl);
  collectChecklistFromUI(model);

  try{
    const ref = db().collection("manager_checklists").doc(docId);
    const snap = await ref.get(); // to keep createdAt stable
    const base = {
      outlet,
      shift,
      date: dateStr,
      version: tpl.version,
      note: model.note || "",
      checkedBy: model.checkedBy || (profile?.name || ""),
      sections: model.sections,
      managerUid: user.uid,
      managerName: profile?.name || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if(!snap.exists){
      base.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    await ref.set(base, { merge: true });

    toast("บันทึก checklist แล้ว ✅", "info");
  }catch(e){
    console.error(e);
    toast("บันทึกไม่สำเร็จ: " + (e?.message||e), "danger");
  }
}

async function markAllDone(){
  const container = el("clContainer");
  const checks = container.querySelectorAll("input[type='checkbox']");
  checks.forEach(c => c.checked = true);
  toast("ติ๊กครบทุกข้อแล้ว ✅", "info");
}
