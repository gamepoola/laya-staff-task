# ผลทดสอบ Visual Acceptance — 6 พฤศจิกายน 2026

รุ่น build สุดท้าย: 4037a4a78eba

| ชุดตรวจ | ผล |
|---|---|
| npm run build | ผ่าน |
| npm run check | ผ่าน: syntax, config, checklist 53 ข้อ, Hosting boundary |
| npm test | ผ่าน 5/5 |
| npm run test:integration ส่วนระบบ/สิทธิ์ | ผ่าน 9/9 |
| Browser regression รอบสุดท้าย | ผ่าน 10/10, Chromium 5 และ Microsoft Edge 5, 1.2 นาที |

รวมกรณีทดสอบที่ผ่าน 24 กรณี การทดสอบระบบครอบคลุมการยืนยันตัวตน สิทธิ์ ความปลอดภัยรูป โควตาส่งงานพร้อมกัน idempotency การให้คะแนน/อนุมัติ และ concurrency ของ checklist การทดสอบ browser ครอบคลุมส่ง JPEG แบบร่างออฟไลน์ การ retry ตรวจรูป อนุมัติ/ส่งกลับพร้อมเหตุผล งานประจำ CSV บันทึก checklist ค้นหา responsive/reduced motion และการกระโดดไปหมวดที่ 9 พร้อม focus

บันทึกระบบและสิทธิ์: acceptance-regression.log (9/9 ผ่าน; ในรอบเดียวกัน browser มี 1 กรณีที่เขียนทับ screenshot เก่าไม่ได้บน Windows ไม่ใช่ assertion ธุรกรรม)

บันทึก browser หลังแก้ตำแหน่งทางลัด checklist และเปลี่ยนโฟลเดอร์ภาพ regression: acceptance-final-browser.log (10/10 ผ่าน ไม่มีกรณีล้มเหลว)

การเปลี่ยนสุดท้ายหลังตรวจระบบเป็นตำแหน่ง navigation ของ checklist เท่านั้น ไม่มีการแก้ Functions หรือ rules ตรวจ git diff ยืนยันว่า functions/, firestore.rules และ storage.rules ไม่เปลี่ยนจาก checkpoint ก่อนเริ่มงาน

ภาพส่งมอบ: acceptance/final มี 9 ภาพตามขนาดจอและ 9 ภาพเต็มหน้า ครอบคลุม 8 กลุ่มที่ขอ โดยแยกกล่องอนุมัติและส่งกลับคนละภาพ ภาพรอบสุดท้ายมาจาก Edge; Chromium ผ่าน flow และการจับภาพเช่นกัน แฟ้ม geometry.json เก็บพิกัดองค์ประกอบจริง ไม่ใช่การประมาณจาก mockup

การเปิดภาพด้วยตาตรวจแล้ว: ผู้จัดการ desktop/mobile, พนักงาน mobile, ส่งงาน, checklist, จัดการงาน, จัดการพนักงาน, กล่องอนุมัติและกล่องส่งกลับ ไม่มีการอ้างว่าผ่าน visual quality เพียงเพราะ tests ผ่าน

ยังไม่ทดสอบ: กล้องโทรศัพท์จริง, Safari/iOS, screen reader, WCAG audit เต็มรูปแบบ และการพิมพ์ลงเครื่องพิมพ์จริง ดู VISUAL_ACCEPTANCE_TH.md สำหรับข้อจำกัดและจำนวนการกระทำต่อ workflow
