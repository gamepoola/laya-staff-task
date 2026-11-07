# FB Staff APP — การตั้งค่า Firebase และความปลอดภัยก่อนปล่อยรุ่น

ชื่อแอปอย่างเป็นทางการคือ **FB Staff APP** เปลี่ยนเฉพาะชื่อแสดงผล/manifest/icon ไม่ใช่ Firebase Project ID. Production เดิมคือ `laya-staff-task-us`; ค่าทั้ง apiKey, authDomain, projectId, storageBucket, messagingSenderId และ appId อ้างอิงตรงตาม config/production.example.js ซึ่งเก็บ Web SDK config ที่เจ้าของให้ไว้ ไม่มี Admin credentials

Development ยังคง demo-laya-v4 บน Emulator กับบัญชีสังเคราะห์; source .firebaserc และ js/firebase-config.js ไม่ชี้ production. ไม่เปลี่ยน IndexedDB ชื่อ laya-v4-drafts, storage paths หรือ session keys เพื่อรักษาแบบร่างและการอัปเกรดเดิม

Staging ต้องเป็น project แยกที่เจ้าของอนุมัติ ใช้ config/staging.example.json เป็นแม่แบบและ tools/prepare-staging.cjs สร้าง directory ใหม่. ตรวจ project/bucket/Auth domain ให้ตรงกัน และปฏิเสธ apiKey/appId ของ production ใน staging. ห้ามนำชื่อ FB Staff APP ไปใช้เป็น project ID หรือสร้าง project เพิ่มเอง

Production config มีไว้เป็น reference เท่านั้น: tools/environment.cjs เทียบทุกค่า Firebase กับ reference เดิม. Build ที่ตั้ง LAYA_RELEASE=true ต้องระบุ LAYA_APPROVED_PROJECT ตรงกับ config ด้วย การตั้งตัวแปรนี้เป็นเพียง guard ทางเทคนิค ไม่ใช่การอนุมัติ deploy จากเจ้าของ. ห้าม deploy จนได้รับการอนุมัติ target/ขอบเขตชัดเจน

Web SDK config เป็นข้อมูล client สาธารณะ ไม่ใช่ service account. เครื่องมือ build ไม่ใส่ privileged credentials ลง public/. สิทธิ์ยังอยู่ที่ Auth, profile/role, rules และ server validation; ไฟล์ rules, transactions, quota, points และ retention logic ไม่เปลี่ยนจาก release ที่ตรวจแล้ว

PWA ใช้ name/short_name FB Staff APP, icon 192/512 แบบ any และ maskable, Apple touch icon 180 และ favicon SVG. พื้นเขียวเต็มรูป ไอคอน FB/ใบไม้/เส้นทองอยู่ใน safe area สำหรับ Android. Splash ที่ระบบสร้างใช้ manifest/icon ใหม่; ยังต้องตรวจติดตั้งและ splash บน Android จริง. Cache identifiers คงเดิม แต่ build identity รวม manifest และ icon SVG เพื่อให้อัปเดต branding ได้

## สิ่งที่ยังต้องตรวจบนคลาวด์

SDK config ไม่ยืนยันว่า Auth/Firestore/Storage/Functions/Hosting/Scheduler พร้อม ต้องตรวจบัญชีผู้มีสิทธิ์และ exact project ก่อนเรียก cloud API. รอบนี้ไม่มีการ deploy เปลี่ยน billing หรือลบข้อมูลจริง ผลตรวจในเครื่องไม่ใช่ live audit

ก่อนเปิดจริงยังต้องยืนยัน Email/Password Auth, App Check, Firestore/Storage rules และ indexes, private evidence CORS/IAM, Functions runtime, Scheduler 02:00 Bangkok, bucket Soft Delete/versioning/holds/lifecycle และสำเนาเก่า. ตรวจ cleanupOldSubmissions กับ archiveApprovedToDrive ว่ายัง deploy อยู่หรือไม่: ตัวแรกอาจลบประวัติ ตัวหลัง archive รูปขัดนโยบายใหม่. ไม่ถือว่าหยุดแล้วเพียงเพราะไม่มีใน source ปัจจุบัน

คำตัดสินยัง NO-GO สำหรับ production และ pilot พนักงานจริง จนผ่าน cloud audit, staging acceptance, backup/restore บนคลาวด์ และ Android จริงตาม RELEASE_READINESS.md. ชุด ZIP เป็น source/public พร้อมเครื่องมือเตรียม staging ไม่ใช่การเปลี่ยน production

ผล read-only access check รอบนี้: Firebase CLI มีบัญชีที่ลงชื่อเข้าใช้ แต่ projects:list ไม่พบ laya-staff-task-us ในรายการที่บัญชีนี้เห็น (docs/fb-cloud-access.json). จึงไม่เรียกตรวจหรือเปลี่ยนทรัพยากรของโปรเจกต์นั้น และยังระบุทุกบริการ production ว่า NOT VERIFIED. ไม่อ้างว่าโปรเจกต์ไม่มีอยู่ เพียงบัญชีปัจจุบันไม่เห็นในรายการ
