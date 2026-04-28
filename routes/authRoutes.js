const express = require("express")
const router = express.Router()

const {
  registerUser,
  loginUser,
  getMe
} = require("../controllers/authController")

const { protect } = require("../middleware/authMiddleware")
const SystemSetting = require("../models/SystemSetting")

// ==========================
// helper เช็คเปิด/ปิดสมัคร
// ==========================
async function isRegisterEnabled() {
  let setting = await SystemSetting.findOne({ key: "register_enabled" })

  if (!setting) {
    setting = await SystemSetting.create({
      key: "register_enabled",
      value: true
    })
  }

  return setting.value === true
}

// ==========================
// REGISTER (มีระบบเปิด/ปิด)
// ==========================
router.post("/register", async (req, res, next) => {
  try {
    const enabled = await isRegisterEnabled()

    if (!enabled) {
      return res.status(403).json({
        error: "ระบบปิดรับสมัครสมาชิกชั่วคราว"
      })
    }

    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}, registerUser)

// ==========================
// LOGIN
// ==========================
router.post("/login", loginUser)

// ==========================
// GET ME
// ==========================
router.get("/me", protect, getMe)

module.exports = router