# Money Tracker • แอปจดเงินคู่ใจ AI (Next.js + Cloudflare D1 + Antigravity MCP)

สร้างตามคู่มือ **"Vibecode จริง: คู่มือสร้างแอปจดเงิน + ต่อ AI ผ่าน MCP"** 
ดัดแปลงการเชื่อมต่อจาก Claude เป็น **Google Antigravity / Gemini AI** พร้อมสถาปัตยกรรมแบบ **Fusion (ผสานแบบ A + B + C เข้าด้วยกัน)**

---

## 🌟 จุดเด่นและสเปกตามคู่มือ

1. **Next.js (App Router) + Tailwind CSS + shadcn/ui + Lucide Icons**
2. **ระบบการเงินแม่นยำ:**
   - เงินจัดเก็บเป็น **"สตางค์" (Satang/Integer)** เพื่อป้องกันปัญหาตัวเลขทศนิยมคลาดเคลื่อน
   - บันทึกวันเวลาตาม **เวลาประเทศไทย (Asia/Bangkok, UTC+7)**
   - ระบบ **Soft Delete** กู้คืนรายการได้เสมอ
3. **ระบบ MCP Server (`/mcp`):**
   - รองรับการเชื่อมต่อกับ Antigravity / Gemini Agent ผ่าน Protocol MCP มาตรฐาน
   - มีป้ายกำกับบอกชัดเจน: รายการที่มาจาก AI มีป้าย **`จาก Antigravity`**, รายการที่จดเองมีป้าย **`จากเว็บ`**
   - ปลอดภัยตามมาตรฐานคู่มือ: Endpoint `/mcp` มีระบบ Authentication ป้องกันบุคคลภายนอกเข้าถึง
4. **ดีไซน์แบบ Fusion (รวม A + B + C):**
   - **แบบ C:** ช่องพิมพ์อัจฉริยะช่องเดียว พิมพ์ "ข้าวมันไก่ 60 กาแฟ 55" กด Enter ปุ๊บ จดลงบัญชีทันที พร้อมเดาหมวดหมู่อัตโนมัติ
   - **แบบ A:** หน้าฟีดแสดงรายการสไตล์สลิปใบเสร็จ (Receipt Stream) เรียบหรู สะอาดตา
   - **แบบ B:** ปฏิทินความร้อน (Heatmap 14 วัน) และกราฟแจกแจงเงินรั่วไหลตามหมวดหมู่ เปรียบเทียบกับช่วงเดือนก่อน
5. **ฟีเจอร์ระดับ Pro:**
   - **Voice Input:** ปุ่มไมโครโฟนกดพูดภาษาไทย แปลงเสียงเป็นตัวหนังสือจดบัญชีได้ทันที
   - **Daily Budget Meter:** แถบเกจคุมงบประมาณรายวัน (เช่น ตั้งไว้ 300 / 500 บาท) เตือนสติก่อนใช้เงินเกิน
   - **Smart Quick Chips:** ปุ่มลัดรายการที่สั่งบ่อย
   - **Export to CSV:** ดาวน์โหลดไฟล์ Excel ได้ทันที

---

## 🚀 วิธีเปิดใช้งานบนเครื่อง (Local Development)

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. เริ่มรันเซิร์ฟเวอร์
npm run dev
```

เปิดเบราว์เซอร์ไปที่: `http://localhost:3000`

---

## 🤖 วิธีเชื่อมต่อกับ Antigravity MCP

ใน Antigravity หรือ Agent MCP Config ให้เพิ่มการตั้งค่า:

```json
{
  "mcpServers": {
    "money-tracker": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer antigravity_secret_mcp_token_2026"
      }
    }
  }
}
```

### คำสั่งที่สามารถพิมพ์คุยกับ AI ได้เลย:
- `"ข้าวมันไก่ 60 กาแฟ 55"`
- `"เมื่อวานค่าแท็กซี่ 120"`
- `"เงินเดือนเข้า 28,000"`
- `"สรุปเดือนที่แล้วให้หน่อย กาแฟหมดไปเท่าไหร่"`
- `"เมื่อกี้ใส่ผิด ข้าวมันไก่เป็น 65"`

---

## ☁️ วิธี Deploy ขึ้น Cloudflare Workers + D1

1. ล็อกอิน Cloudflare ผ่าน CLI:
   ```bash
   npx wrangler login
   ```
2. สร้างฐานข้อมูล D1:
   ```bash
   npx wrangler d1 create money_tracker_db
   ```
   (นำ `database_id` ที่ได้ไปใส่ใน `wrangler.toml`)

3. รัน Migrate ตารางข้อมูล:
   ```bash
   npx wrangler d1 execute money_tracker_db --file=./schema.sql
   ```
4. Deploy ขึ้น Cloudflare:
   ```bash
   npm run deploy
   ```
