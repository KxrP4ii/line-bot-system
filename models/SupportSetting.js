const mongoose = require("mongoose")

const supportSettingSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true
    },
    reminderMinutes: {
      type: Number,
      default: 30
    },
    reminderText: {
      type: String,
      default: "ขออภัยที่ให้รอนานครับ ทีมงานได้รับเรื่องแล้ว และจะรีบเข้ามาดูแลโดยเร็วที่สุดครับ 🙏"
    },
    supportKeywords: {
      type: [String],
      default: [
        "ปัญหา",
        "เสีย",
        "ใช้ไม่ได้",
        "ใช้งานไม่ได้",
        "ไม่ทำงาน",
        "ติดขัด",
        "error",
        "เออเร่อ",
        "แจ้งซ่อม",
        "ซ่อม",
        "ช่วยดู",
        "ช่วยหน่อย",
        "สอบถาม",
        "ขอสอบถาม",
        "ทำยังไง",
        "เปิดไม่ติด",
        "ชาร์จไม่เข้า",
        "แบต",
        "เครื่องค้าง",
        "เสียงดัง",
        "น้ำไม่ออก",
        "ดูดไม่เข้า"
      ]
    },
    cleaningKeywords: {
      type: [String],
      default: [
        "ทำความสะอาด",
        "ทำความสะอาดแล้ว",
        "ล้างแล้ว",
        "เช็ดแล้ว",
        "เรียบร้อย",
        "ส่งงาน",
        "รายงาน",
        "ประจำวัน",
        "ก่อนใช้งาน",
        "หลังใช้งาน"
      ]
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("SupportSetting", supportSettingSchema)