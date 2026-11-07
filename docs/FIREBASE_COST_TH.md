# ประมาณค่าใช้จ่าย Blaze สำหรับ pilot

จัดทำ 7 พฤศจิกายน 2026 จากตารางราคา official ที่ตรวจระหว่าง 6–7 พฤศจิกายน ไม่เปิด billing หรือแก้งบ เป็นแบบจำลอง ไม่ใช่ใบเสนอราคา/ยอดใช้งานจริง

สมมติใช้ us-central1 (Iowa), Firestore Standard default database, Standard Storage flat namespace, Cloud Functions รุ่น 2/Cloud Run request-based, ไม่มี min instances. แปลง USD เป็นบาทด้วย **35 บาท/USD เป็นสมมติฐานงบประมาณ ไม่ใช่อัตราแลกเปลี่ยนสด** ไม่รวมภาษีหรือส่วนต่างราคาสกุลเงินจริงใน billing account

## ปริมาณที่ใช้คำนวณเอง

50 คน × 8 รูป/วัน × 30 วัน = 12,000 รูป/เดือน ขนาด 0.5 MB decimal = อัปโหลดหลักฐาน 6 GB (5.588 GiB)/เดือน แอปมี drafts และ canonical copies จึงคิด 24,000 writes ของรูป ไม่ใช่ 12,000. อายุเฉลี่ยสูงสุดเชิงแบบจำลอง 7.5 วันจากรอบวันละครั้ง → รูปคงค้างเฉลี่ย 6,000 objects รวมสำเนา, 3 GB (2.794 GiB)

อ่าน/ดูรูปเฉลี่ยสองครั้งต่อรูป = 11.176 GiB egress/เดือน. Cleanup metadata scan ประมาณ 180,000 GET/เดือน; รวม upload checks, server reads, viewer/download และ status ประมาณ 264,000 Class B; Class A ประมาณ 25,890 (uploads+listing). การให้ manager เปิดหน้ารายงานซ้ำบ่อยและหลายรูปต่อรายการเพิ่ม metadata GET ได้อีก

Functions สมมติ 100,000 requests × 0.25 วินาที + cleanup 9,000 วินาที/เดือน = 34,000 vCPU-seconds; ประมาณ 17,000 GiB-seconds ที่ 512MiB แบบเผื่อสูงกว่า memory ของ cleanup จริง. Firestore สมมติ reads 600,000, writes 200,000/เดือน รวม lease/receipts และธุรกรรม, ข้อมูล+index 0.25 GiB. Log 0.05 GiB/เดือน. records backup 1 GiB-month. ตัวเลข workload เป็นสมมติฐาน ต้องแทนด้วย métrics staging

## อัตราอ้างอิงและ free quota

- Storage Iowa Standard ประมาณ $0.02/GiB-month; Class A $0.005/1,000, B $0.0004/1,000; egress ไปไทย $0.12/GiB ใน tier แรก; delete Standard ไม่มี operation fee. Free quota ที่เข้าเงื่อนไขภูมิภาค US: 5 GB-month, A 5,000, B 50,000 และ data transfer 100 GB (ข้อยกเว้น China/Australia). Nearline/Coldline/Archive คิดอายุขั้นต่ำ 30/90/365 วัน จึงเลือก Standard. [Cloud Storage pricing](https://cloud.google.com/storage/pricing)
- Firestore Iowa: reads $0.03/100k, writes $0.09/100k; storage ประมาณ $0.15/GiB-month, backup ประมาณ $0.03/GiB-month. Free: reads 50k/day, writes 20k/day, storage 1GiB สำหรับ default database ที่เข้าเงื่อนไข; backups/restore ไม่ฟรี. [Firestore pricing](https://cloud.google.com/firestore/pricing)
- Cloud Run request-based: CPU $0.000024/vCPU-second, memory $0.0000025/GiB-second, requests $0.40/million; free 180k vCPU-seconds, 360k GiB-seconds และ 2 million requests ต่อเดือนตามเงื่อนไข billing account. [Cloud Run pricing](https://cloud.google.com/run/pricing)
- Scheduler $0.10/job/เดือน และมี allowance 3 jobs ตามเงื่อนไข account. [Scheduler pricing](https://cloud.google.com/scheduler/pricing)
- Logging ingestion $0.50/GiB พร้อม 50GiB/project/month free และระยะเก็บพื้นฐานตามบริการ; native metrics หลายชนิดไม่มีค่า ingestion. [Observability pricing](https://cloud.google.com/products/observability/pricing)

## ผลโมเดล 30 วัน

| หมวด | USD ก่อนหัก free quota | บาทโดยประมาณ |
|---|---:|---:|
| รูปคงค้างรวม drafts | 0.056 | 1.96 |
| Storage Class A | 0.129 | 4.52 |
| Storage Class B รวม cleanup | 0.106 | 3.71 |
| ดูรูปสองครั้ง/รูป — egress | 1.341 | 46.94 |
| Firestore reads+writes+storage | 0.398 | 13.93 |
| Functions compute/memory/requests | 0.899 | 31.47 |
| Scheduler 1 job | 0.100 | 3.50 |
| Log ingestion | 0.025 | 0.88 |
| records backup 1 GiB-month | 0.030 | 1.05 |
| **รวมแบบไม่หัก free quota** | **ประมาณ 3.18** | **ประมาณ 111 บาท/เดือน** |

หาก free quota ทั้งหมดข้างต้นยังเหลือและใช้งานกระจายรายวันตามสมมติฐาน จะเหลือหลัก ๆ Class A ≈$0.104, Class B ≈$0.086 และ records backup ≈$0.03 รวมประมาณ $0.22 หรือ 8 บาท/เดือน **เฉพาะรายการในโมเดล**. ไม่รับประกันค่าใช้จ่ายนี้ เพราะ free tier บางตัวแชร์ข้าม projects/billing account, peak รายวัน และการเปิดรายงานซ้ำต่างจากค่าเฉลี่ย

ยังไม่รวม Cloud Build/Artifact Registry จากความถี่ deploy และขนาด image, Hosting transfer ที่เกิน free quota, App Check/reCAPTCHA assessments ส่วนเกิน, SMS/Auth ที่ไม่ใช่ Email/Password, custom metrics/alerts, การ restore จริง ($0.20/GiB ตามตาราง Firestore) และงาน backup scheduler เพิ่มเติม. ต้องใช้ billing export/เครื่องคำนวณ official เติม SKU เหล่านี้ก่อนอนุมัติงบ; กันงบเริ่มต้น **500 บาท/เดือน** แล้วปรับตามผล pilot ไม่ใช่ข้อสัญญาว่าจะไม่เกิน

หากดูภาพ 10 ครั้งแทนสองครั้ง egress เพิ่มราว 44.7 GiB ก่อนหัก free quota หรือประมาณ $5.36/188 บาทเพิ่ม รูปถูกลบไม่ได้ทำให้ค่า Functions/Firestore/operations/egress หายไป ประวัติและ receipt โตต่อเนื่องตามนโยบาย records retention

แนะนำ budget alert 50%, 80%, 100% และ forecast เกินงบ ส่งให้เจ้าของกับผู้ดูแลที่กำหนดหลังอนุมัติ ตรวจยอดรายวันสัปดาห์แรกและ cleanup scanned/deleted/failed/incomplete ทุกวัน Budget alert ไม่ใช่ spending cap. ไม่เปิด billing/alerts หรือเปลี่ยน spending settings ในรอบนี้
