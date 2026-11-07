# นโยบายหลักฐาน 7 วันและคู่มือ cleanup

รูปงานและรูป checklist ลบอัตโนมัติเมื่ออายุอย่างน้อย 168 ชั่วโมงนับจาก Storage `timeCreated` ของไฟล์แต่ละรุ่น งานประจำวันทำเวลา 02:00 Asia/Bangkok จึงอาจเหลือรูปเกินอายุได้อีกราว 24 ชั่วโมง ไม่มีข้อยกเว้นสำหรับรอตรวจ/ให้แก้ไข/อนุมัติ ไม่มี archive หรือ backup รูป

## ขอบเขตที่ตรวจจาก source

| Prefix | ความหมาย | นโยบายใหม่ |
|---|---|---|
| drafts/{uid}/{requestId}/{0-9}.jpg | รูปอัปโหลดชั่วคราว รวมของ checklist | 168 ชั่วโมงของรุ่นนั้น ป้องกันสำเนาแบบร่างค้างถาวร |
| evidence/{uid}/{date}__{uid}__{taskId}/{requestId}/{0-9}.jpg | หลักฐานงาน V4 รวม revision และ orphan หลังส่งล้มเหลว | 168 ชั่วโมงของรุ่นนั้น |
| checklistEvidence/{outlet}_{date}_{shift}/{requestId}.jpg | หลักฐาน checklist | 168 ชั่วโมงของรุ่นนั้น |
| submissions/{date}/{uid}/{taskId}/{file} | รูปแบบเก่า เปิดอ่านเพื่อ compatibility | ยังไม่ลบ: ต้องสำรวจ metadata/รุ่นเก่าจริงและอนุมัติ migration ก่อน pilot |
| profiles/, assets/, อื่น ๆ | ไม่มี uploader ในแอป V4 นี้ อาจเป็นไฟล์ระบบอื่น | ไม่แตะ |

โค้ด `functions/retention.cjs` ตรวจรูปแบบ path, owner ใน submission ID, JPEG MIME, size 1–2097152 bytes, numeric generation, timeCreated และ holds ไม่ใช้ชื่อวันที่ใน path ตัดสินอายุ ไม่ใช้วันที่ผู้ใช้ส่งมา ไม่ลบแบบกวาดทั้ง bucket

อ่านทีละไม่เกิน 100 objects มี pagination, cursor ใน maintenance/evidenceCleanup, lease 12 นาทีและ token ป้องกันงานชนกัน จำกัดเวลา scan 420 วินาทีก่อน retry ต่อ cursor; function timeout 540 วินาที, maxInstances=1, retry สูงสุด 3 ครั้ง หากยังไม่ครบต้องแจ้งผู้ดูแล อย่ารอจนเกินนโยบายโดยไม่ทราบเหตุ

ก่อนลบเขียน receipt `evidenceRetention/{sha256(path)}` สถานะ deleting แล้วลบด้วย ifGenerationMatch ของ metadata ที่อ่าน หลังลบเปลี่ยนเป็น deleted. HTTP 412 หมายถึงไฟล์เปลี่ยนรุ่น จึงไม่ลบรุ่นใหม่; 404 ไม่ทำให้งานล้ม. งานถัดไปกู้ receipt ที่ค้าง deleting ได้ Log เก็บ hash ไม่บรรจุภาพ/ชื่อพนักงาน ส่วน receipt เก็บเฉพาะ path, generation, createdAt, deletedAt, kind, policyHours, state. ไม่เขียน staff/tasks/submissions/approvals/checklists/points

การใช้ generation precondition ป้องกัน retry ลบไฟล์รุ่นใหม่เป็นพฤติกรรมของ [Cloud Storage preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions). Emulator ทดสอบขอบเขต/การลบจริง ส่วน race 412 ใช้ adapter จำลองตาม API; ต้องพิสูจน์ซ้ำบน staging GCS จริง

## เปิดใช้งานอย่างมีหลักฐาน

ค่าเริ่มต้น `CLEANUP_MODE=dry-run` ยังไม่ลบรูปจริง เมื่อ owner อนุมัติโปรเจกต์และ bucket แล้ว: ตรวจ inventory, dry-run log, backups/versions/holds และทดสอบ staging ก่อนตั้ง `CLEANUP_MODE=delete`, `RETENTION_BUCKET_REVIEWED=true`, `EVIDENCE_BUCKET=<approved bucket>`. ไม่ต้องให้ manager กดเอง scheduler ทำงานอัตโนมัติหลัง deploy ที่อนุมัติ

ขณะ delete scheduler อ่าน bucket metadata และปฏิเสธหากเปิด Soft Delete, versioning, retention policy, default hold หรือ lifecycle rule. ห้ามข้าม guard เพื่อทำให้ทดสอบผ่าน ข้อมูล metadata ที่ไม่ตรงเงื่อนไขจะข้ามและเพิ่ม invalid counter; ผู้ดูแลต้องสอบสวน ไม่ถือว่าลบครบ

## Bucket จริง: ยังไม่ได้ตรวจหรือเปลี่ยนค่า

ไม่มีผล live audit ของ bucket production/staging ในรอบนี้ จึงยังไม่รับรองว่าลบถาวรได้ ให้ผู้ดูแลที่ได้รับอนุมัติเก็บผล `gcloud storage buckets describe gs://BUCKET --format=json` และ inventory current/noncurrent/soft-deleted objects พร้อมรายการ lifecycle/holds/retention, IAM, CORS, storage class, replication/transfer jobs และ backup destinations

ใช้ bucket เฉพาะ evidence ในโปรเจกต์ staging แยก การเปลี่ยน Soft Delete เป็น 0 และปิด versioning ทำใน Console หลังอนุมัติผลกระทบเท่านั้น ตรวจรุ่นเก่าที่ค้างด้วย เพราะปิด versioning ไม่ได้ทำให้สำเนาเดิมหายไป และไฟล์ที่ soft-delete ไปก่อนเปลี่ยนนโยบายอาจยังอยู่จนครบกำหนดเดิม ดู [Soft Delete](https://docs.cloud.google.com/storage/docs/soft-delete)

หาก bucket เดิมแชร์กับไฟล์สำคัญ: ห้ามปิดการป้องกันทั้ง bucket. สร้าง evidence bucket เฉพาะหลังอนุมัติ แยก client storageBucket กับ server EVIDENCE_BUCKET ให้ตรงกัน ทดสอบ rules/CORS/IAM ก่อนสลับการอัปโหลด ไม่ copy รูปเก่าทั้งหมดโดยอัตโนมัติ เพราะ timeCreated จะเริ่มใหม่และอาจยืดอายุ ให้ทำรายการไฟล์พร้อมต้นทาง/อายุและแผนจัดการที่ owner อนุมัติ รูปที่หมดอายุแล้วไม่ย้ายไปสำรอง

เลือก Standard Storage; Nearline/Coldline/Archive มีอายุคิดค่าบริการขั้นต่ำ 30/90/365 วันตาม [Storage pricing](https://cloud.google.com/storage/pricing) จึงไม่เหมาะกับนโยบายนี้

## ประสบการณ์ผู้ใช้

evidenceStatus ตรวจสิทธิ์ก่อนอ่าน metadata/receipt เจ้าของหรือ manager จึงรู้สถานะได้ เมื่อไฟล์หายและมี receipt จะแสดง “รูปหลักฐานหมดอายุและถูกลบอัตโนมัติหลัง 7 วัน” โดยไม่สร้าง img ที่พัง ไฟล์หายที่ไม่มี receipt แสดงไม่พบรูปแทน ไม่กล่าวอ้างว่า cleanup ลบ

รายการรอตรวจในหน้าปัจจุบันตรวจ metadata จริงสูงสุด 10 รูปต่อรายการ เตือนเมื่อเหลือไม่เกิน 24 ชั่วโมง หรือครบอายุแต่ยังรอรอบลบ ปุ่มดูรูป/อนุมัติ/ให้แก้ไขเดิมใช้ต่อได้ ไม่มีจำนวน notification ที่แต่งขึ้น Manager ต้องตรวจให้ทันก่อนครบ 7 วัน; ประวัติการตรวจและคะแนนยังอ่านได้หลังรูปหมดอายุ

ผล dry-run สังเคราะห์อยู่ใน CLEANUP_DRY_RUN.json; การทดสอบใช้ timeCreated จริงจาก emulator แล้วขยับนาฬิกาของฟังก์ชันภายในสำหรับทดสอบเท่านั้น ไม่แก้ timestamp ให้ดูเก่า และไม่เปิดตัวเลือกปรับนาฬิกาใน callable/scheduler

## สิ่งที่พบจาก source ต้นฉบับก่อน V4

ตรวจ ../original/laya-staff-task-main/functions/index.js พบ `cleanupOldSubmissions` กำหนดทุกวัน 03:30 Asia/Bangkok อ่าน submissions.date เก่ากว่า cutoff แล้วลบ photoPath และลบ submission document; ไม่ตรงข้อกำหนดเก็บประวัติของ release ใหม่นี้. อีกตัว `archiveApprovedToDrive` trigger เมื่อ status เปลี่ยนเป็น approved แล้วส่งรูปไป Google Drive; ขัดกับข้อห้าม archive รูป. ทั้งสองไม่อยู่ใน Functions source รุ่น release แต่ไม่ได้พิสูจน์ว่าสิ่งที่ deploy เดิมถูกลบ/ปิดแล้ว ต้องให้ผู้ดูแลตรวจ live inventory และเสนอปิดสองตัวนี้โดยได้รับอนุมัติก่อน rollout. ห้ามสั่ง deploy แบบอัตโนมัติที่ยอมรับการลบฟังก์ชันเก่าโดยไม่ทบทวนรายการ
