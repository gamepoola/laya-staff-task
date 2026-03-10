# Laya Operations Hub - Meal Plan Integrated

เว็บแอพแบบ Static สำหรับอัปขึ้น GitHub Pages ได้ทันที

## ในเวอร์ชันนี้
- หน้าเมนูหลักมีการ์ดงาน 7 งานเหมือนเดิม
- กดเข้าแต่ละหัวข้อได้จากหน้า Dashboard และ Sidebar
- หน้า **LAYA MEAL PLAN RECORD** เป็นเวอร์ชันใช้งานจริง
- ช่องใส่จำนวนแขกในแต่ละวันถูกขยายให้ใส่เลขได้ 3 หลักอย่างชัดเจน
- เปลี่ยนเดือนและปีได้อิสระ
- หน้า Meal Plan เชื่อม Firebase / Firestore ได้
- โมดูลอื่น ๆ ยังใช้งานเก็บข้อมูลใน localStorage ได้

## Firebase
ตั้งค่าเริ่มต้นให้กับโปรเจกต์ `laya-fb` แล้ว
- collection: `layaMealPlanMonths`
- document id: `YYYY-MM`

## ไฟล์ในชุดนี้
- index.html
- styles.css
- app.js
- README.md
