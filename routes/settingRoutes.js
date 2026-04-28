const express = require("express")
const router = express.Router()

const SystemSetting = require("../models/SystemSetting")
const { protect } = require("../middleware/authMiddleware")
const { emitAll } = require("../services/socketService")

function isAdmin(role) {
  return ["approver", "superadmin"].includes(role)
}

async function getRegisterSetting() {
  let setting = await SystemSetting.findOne({ key: "register_enabled" })

  if (!setting) {
    setting = await SystemSetting.create({
      key: "register_enabled",
      value: true
    })
  }

  return setting
}

// เปิดให้หน้า Login อ่านได้
router.get("/register", async (req, res) => {
  try {
    const setting = await getRegisterSetting()

    res.json({
      registerEnabled: setting.value === true
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// เฉพาะ admin เท่านั้นที่เปิด/ปิดได้
router.put("/register", protect, async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์ตั้งค่าระบบ" })
    }

    const { registerEnabled } = req.body

    const setting = await SystemSetting.findOneAndUpdate(
      { key: "register_enabled" },
      { value: registerEnabled === true },
      { new: true, upsert: true }
    )

    emitAll({
      source: "settings",
      action: "register-toggle",
      registerEnabled: setting.value === true
    })

    res.json({
      message: "อัปเดตสถานะการสมัครสมาชิกสำเร็จ",
      registerEnabled: setting.value === true
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router