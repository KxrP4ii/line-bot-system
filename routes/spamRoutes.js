const express = require("express")
const router = express.Router()

const { protect, isAdmin } = require("../middleware/authMiddleware")
const {
  getActiveMutes,
  getSpamLogs,
  clearMute,
  clearAllMutes,
  clearSpamLogs
} = require("../services/rateLimitService")

router.get("/status", protect, isAdmin, async (req, res) => {
  try {
    return res.json({
      activeMutes: getActiveMutes(),
      logs: getSpamLogs()
    })
  } catch (error) {
    return res.status(500).json({ error: "โหลดข้อมูล spam ไม่สำเร็จ" })
  }
})

router.post("/clear-mute", protect, isAdmin, async (req, res) => {
  try {
    const { userId, groupId } = req.body

    if (!userId || !groupId) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบ" })
    }

    clearMute(userId, groupId)

    return res.json({ message: "ปลด mute สำเร็จ" })
  } catch (error) {
    return res.status(500).json({ error: "ปลด mute ไม่สำเร็จ" })
  }
})

router.post("/clear-all-mutes", protect, isAdmin, async (req, res) => {
  try {
    clearAllMutes()
    return res.json({ message: "ล้าง mute ทั้งหมดสำเร็จ" })
  } catch (error) {
    return res.status(500).json({ error: "ล้าง mute ไม่สำเร็จ" })
  }
})

router.post("/clear-logs", protect, isAdmin, async (req, res) => {
  try {
    clearSpamLogs()
    return res.json({ message: "ล้าง spam logs สำเร็จ" })
  } catch (error) {
    return res.status(500).json({ error: "ล้าง logs ไม่สำเร็จ" })
  }
})

module.exports = router