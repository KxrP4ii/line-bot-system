const express = require("express")
const router = express.Router()

const SupportTicket = require("../models/SupportTicket")
const SupportSetting = require("../models/SupportSetting")
const { protect } = require("../middleware/authMiddleware")

function canViewSupport(req, res, next) {
  if (!req.user || !["approver", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" })
  }

  next()
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item || "").trim().toLowerCase())
      .filter(Boolean)
  }

  return String(value || "")
    .split(/\n|,/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

async function getOrCreateSetting() {
  let setting = await SupportSetting.findOne()

  if (!setting) {
    setting = await SupportSetting.create({})
  }

  return setting
}

router.get("/settings", protect, canViewSupport, async (req, res) => {
  try {
    const setting = await getOrCreateSetting()
    return res.json(setting)
  } catch (error) {
    console.error("get support settings error:", error)
    return res.status(500).json({
      error: "โหลดการตั้งค่าไม่สำเร็จ",
      detail: error.message
    })
  }
})

router.put("/settings", protect, canViewSupport, async (req, res) => {
  try {
    const setting = await getOrCreateSetting()

    setting.enabled = Boolean(req.body.enabled)
    setting.reminderMinutes = Math.max(1, Number(req.body.reminderMinutes || 30))
    setting.reminderText =
      String(req.body.reminderText || "").trim() ||
      "ขออภัยที่ให้รอนานครับ ทีมงานได้รับเรื่องแล้ว และจะรีบเข้ามาดูแลโดยเร็วที่สุดครับ 🙏"

    const supportKeywords = normalizeKeywords(req.body.supportKeywords)
    const cleaningKeywords = normalizeKeywords(req.body.cleaningKeywords)

    if (supportKeywords.length) {
      setting.supportKeywords = supportKeywords
    }

    if (cleaningKeywords.length) {
      setting.cleaningKeywords = cleaningKeywords
    }

    await setting.save()

    return res.json({
      message: "บันทึกการตั้งค่าสำเร็จ",
      setting
    })
  } catch (error) {
    console.error("update support settings error:", error)
    return res.status(500).json({
      error: "บันทึกการตั้งค่าไม่สำเร็จ",
      detail: error.message
    })
  }
})

router.get("/", protect, canViewSupport, async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .sort({ createdAt: -1 })
      .limit(100)

    return res.json(tickets)
  } catch (error) {
    return res.status(500).json({
      error: "โหลด ticket ไม่สำเร็จ",
      detail: error.message
    })
  }
})

router.post("/close/:id", protect, canViewSupport, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)

    if (!ticket) {
      return res.status(404).json({ error: "ไม่พบ ticket" })
    }

    ticket.status = "closed"
    ticket.closedAt = new Date()
    await ticket.save()

    return res.json({ message: "ปิดเคสแล้ว" })
  } catch (error) {
    return res.status(500).json({
      error: "ปิดเคสไม่สำเร็จ",
      detail: error.message
    })
  }
})

module.exports = router