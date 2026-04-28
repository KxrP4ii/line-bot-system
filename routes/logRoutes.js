const express = require("express")
const router = express.Router()

const Log = require("../models/Log")
const { protect, canViewLogs } = require("../middleware/authMiddleware")

router.get("/", protect, canViewLogs, async (req, res) => {
  try {
    const logs = await Log.find().sort({ createdAt: -1 }).limit(500)
    return res.json(logs)
  } catch (error) {
    return res.status(500).json({ error: "โหลด logs ไม่สำเร็จ" })
  }
})

module.exports = router