# FB Staff APP — ผลตรวจเปลี่ยนชื่อและสภาพแวดล้อม

วันที่ 7 พฤศจิกายน 2026 ต่อจาก release commit 2eaf15d และ implementation 9365336 ไม่ย้อนรุ่น ไม่แก้ Functions/rules/indexes/ธุรกรรม

- Build ผ่าน hash `dc35542858d6`; build identity รวม manifest และ icon SVG เพิ่มแล้ว
- Source/config checks ผ่าน
- Domain/backup/branding/environment tests ผ่าน 8/8
- Security/cleanup/restore/staging/pilot tests ผ่าน 19/19
- Browser Chromium และ Edge ผ่าน 14/14 รวมตรวจชื่อบน login/manager desktop/staff mobile
- รวม **41 กรณีที่ไม่ซ้ำผ่านทั้งหมด** โดยชุดเดิม 37 กรณีผ่านใหม่ครบ
- Release guard ปฏิเสธการใช้ emulator build อ้าง production project จริง ทดสอบผ่านโดยไม่ deploy
- Manifest name/short_name, title ทุก route, opaque PNG ขนาด 192/512 และ maskable ตรวจแล้ว

Raw logs: fb-branding-unit.log, fb-branding-check.log, fb-branding-regression.log, fb-release-guard.log. ภาพ browser จริง: fb-branding-captures/2026-11-07/{Chromium,Edge}/branding/. ตรวจภาพ staff mobile และ icon จริงด้วยตาแล้ว ไม่มีส่วนล้นจอใน viewport ที่ทดสอบ

แก้ระหว่างตรวจ: SVG raster เดิมมี alpha channel แม้พื้นเขียวเต็ม ปรับ generator ให้ flatten PNG และรัน branding test ใหม่ผ่าน จึงเหมาะกับ maskable/installation asset โดยไม่พึ่งพื้นโปร่งใส

Production Web SDK reference คงค่าจาก config/production.example.js ทุก field. API key/appId เดิมถูกปฏิเสธหากนำมาปะปน staging; staging project/bucket/Auth domain ต้องตรงกัน. ไม่ใส่ service account ลง public และยังไม่เปลี่ยน source .firebaserc จาก demo-laya-v4

Firebase CLI read-only login/projects listing สำเร็จ แต่ไม่พบ laya-staff-task-us ในรายการที่บัญชีปัจจุบันเข้าถึงได้ จึงยัง NOT VERIFIED สำหรับ Auth/Firestore/Storage/Functions/Hosting/Scheduler, Soft Delete/versioning/retention/legacy deployed jobs จริง ไม่อนุมานสถานะจาก Web SDK config

Android installation/splash, PWA update ของแอปที่เคยติดตั้ง และกล้องจริงยัง NOT TESTED บนอุปกรณ์จริง. ประวัติภาพจากรุ่นก่อนเก็บเป็นหลักฐานย้อนหลัง ไม่แก้ภาพเก่าให้ดูเหมือนเป็นแบรนด์ใหม่

คำตัดสิน: GO สำหรับชุด source และการเตรียม staging หลังอนุมัติ target; NO-GO สำหรับ production และ pilot จริงจนกว่าจะผ่าน blockers ตาม FB_STAFF_APP_FIREBASE_TH.md และ RELEASE_READINESS.md
