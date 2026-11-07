# สำรองและกู้คืนข้อมูลปฏิบัติงาน — ไม่รวมรูป

สำรอง staff/tasks/assignments/submissions และ revisions/approvals, manager_checklists และ history, pointTransactions, dailyQuotas, auditLogs, photoMetadata, evidenceRetention และ settings. Auth identities/password hashes แยกจาก Firestore ต้องให้ผู้ดูแลเก็บผ่านบริการ Auth ที่อนุมัติและควบคุมการเข้าถึง; อย่าอ้างว่ากู้บัญชี login ได้จาก Firestore อย่างเดียว

## ซ้อมในเครื่องที่ดำเนินการแล้ว

tools/records-backup.cjs ส่งออกเฉพาะ records พร้อม subcollections แบบแบ่งหน้า เก็บ Timestamp/GeoPoint/reference/bytes โดยไม่แปลงชนิดทิ้ง เข้ารหัส AES-256-GCM + scrypt และปฏิเสธรหัสผ่านสั้นกว่า 16 ตัว ใช้เฉพาะ FIRESTORE_EMULATOR_HOST และ demo-laya-*; restore ต้องเป็นคนละ project และ collections เป้าหมายต้องว่าง ไม่เขียนทับข้อมูลเดิม

ตั้ง LAYA_BACKUP_PASSPHRASE เป็นรหัสยาวแบบสุ่มและเก็บแยกไฟล์ ห้ามใส่คำสั่งที่มีรหัสจริงลงประวัติหรือ log. ใช้ `node tools/records-backup.cjs export demo-laya-SOURCE NEW-encrypted-file` และ `restore demo-laya-TARGET encrypted-file` ภายใน emulator. เครื่องมือไม่อ่าน Storage และไม่มีรูปใน archive. ตรวจสิทธิ์ไฟล์ NTFS ด้วย เพราะ mode ของไฟล์ไม่แทน Windows ACL

ผลซ้อมแยก demo-laya-backup-source กับ demo-laya-backup-target: เทียบ records ทุก field, timestamp, ความสัมพันธ์ task/staff, คะแนนกับ ledger, approvals, checklist history และ receipt รูปหมดอายุ ดู RESTORE_REHEARSAL.json. การทดสอบรหัสถอดผิดต้องล้มเหลว เป้าหมายไม่ว่างต้องปฏิเสธ

## แผน cloud หลังอนุมัติ

ตั้ง scheduled Firestore records-only backup วันละครั้ง เก็บ 7 daily + 4 weekly ตามนโยบายข้อมูลบุคลากรที่เจ้าของอนุมัติ ไม่ใช้ bucket evidence เป็นปลายทาง. ใช้ managed Firestore backup/export ที่เข้ารหัสและ IAM เฉพาะทีม recovery. ต้องรวม subcollection approvals/revisions/history ด้วย หากใช้ collection-group filters ห้ามเลือกเฉพาะ parent จนประวัติหาย

RPO เป้าหมาย 24 ชั่วโมง, RTO เป้าหมาย 4 ชั่วโมง เป็นเป้าหมายยังไม่ได้วัดใน cloud. ระหว่าง snapshot rehearsal ให้หยุดการเขียนสังเคราะห์เพื่อจุดข้อมูลสอดคล้องกัน ตัว exporter ในเครื่องไม่ใช่ transaction snapshot ของฐานข้อมูลที่กำลังถูกเขียน สำหรับ live ใช้ managed backup/PITR ที่อนุมัติและทดสอบ billing แยก

ลำดับ restore จริง: อนุมัติ isolated staging target → จำกัดผู้เข้าถึง/หยุด jobs → ตรวจ checksum/manifest/เวลาของ backup → restore records → provision Auth UID ให้ตรงและ revoke sessions ตามเหตุการณ์ → เทียบจำนวน/hash/ความสัมพันธ์และ ledger → ตรวจ expired evidence UI → เปิด synthetic acceptance → บันทึกผู้อนุมัติก่อน cutover. ไม่ restore เข้า production ในรอบงานนี้

ห้าม restore รูปจาก backup; path ที่ยังมีอยู่ในประวัติและ receipt ช่วยแสดงว่ารูปหมดอายุแล้ว ถ้า backup เก่าไม่มี receipt แต่รูปหาย UI แสดงไม่พบรูปอย่างตรงไปตรงมา เก็บ cleanup receipts ใน records backup ล่าสุด ไม่สร้างภาพหรือคะแนนขึ้นใหม่เพื่อให้ข้อมูลดูครบ

ยังไม่ทราบว่า backup/Drive archive เดิมใน cloud มีรูปอยู่หรือไม่ ต้อง inventory destinations, jobs, versions และช่วงอายุ จากนั้นเสนอการลบ/หมดอายุแบบระบุรายการให้เจ้าของอนุมัติ ไม่มีการลบ backup จริงหรือปิดการป้องกัน shared bucket ในงานนี้ นโยบายใหม่นี้ยกเลิกข้อเสนอ Drive archive ของเอกสารรุ่นเก่า

หลักฐาน source ของ archive เดิม: functions/index.js ในโฟลเดอร์ original มี archiveApprovedToDrive; จึงต้องตรวจ Drive destination และ driveUploaded/driveFileId เดิมโดยผู้มีสิทธิ์ ไม่ถือว่าไม่มีสำเนาเพียงเพราะ release ใหม่ไม่มี trigger นี้. ยังไม่ได้อ่านหรือลบข้อมูล Drive จริง
