const express = require("express")
const router = express.Router()

const LineGroup = require("../models/LineGroup")
const { protect, canManageGroups } = require("../middleware/authMiddleware")

router.get("/", protect, canManageGroups, async (req, res) => {
  try {
    const groups = await LineGroup.find().sort({ updatedAt: -1 })
    return res.json(groups)
  } catch (error) {
    return res.status(500).json({ error: "โหลดกลุ่มไม่สำเร็จ" })
  }
})

router.post("/", protect, canManageGroups, async (req, res) => {
  try {
    const { groupId, groupName, isActive } = req.body

    if (!groupId) {
      return res.status(400).json({ error: "กรุณากรอก groupId" })
    }

    const exists = await LineGroup.findOne({ groupId: String(groupId).trim() })
    if (exists) {
      return res.status(400).json({ error: "groupId นี้มีอยู่แล้ว" })
    }

    const group = await LineGroup.create({
      groupId: String(groupId).trim(),
      groupName: String(groupName || "").trim(),
      isActive: Boolean(isActive),
      lastSeenAt: new Date()
    })

    return res.status(201).json({
      message: "เพิ่มกลุ่มสำเร็จ",
      group
    })
  } catch (error) {
    return res.status(500).json({ error: "เพิ่มกลุ่มไม่สำเร็จ" })
  }
})

router.put("/:id", protect, canManageGroups, async (req, res) => {
  try {
    const group = await LineGroup.findById(req.params.id)
    if (!group) {
      return res.status(404).json({ error: "ไม่พบกลุ่ม" })
    }

    const { groupName, isActive } = req.body

    if (typeof groupName !== "undefined") {
      group.groupName = String(groupName || "").trim()
    }

    if (typeof isActive !== "undefined") {
      group.isActive = Boolean(isActive)
    }

    await group.save()

    return res.json({
      message: "อัปเดตกลุ่มสำเร็จ",
      group
    })
  } catch (error) {
    return res.status(500).json({ error: "อัปเดตกลุ่มไม่สำเร็จ" })
  }
})

router.put("/toggle/:id", protect, canManageGroups, async (req, res) => {
  try {
    const group = await LineGroup.findById(req.params.id)
    if (!group) {
      return res.status(404).json({ error: "ไม่พบกลุ่ม" })
    }

    group.isActive = !group.isActive
    await group.save()

    return res.json({
      message: "เปลี่ยนสถานะกลุ่มสำเร็จ",
      group
    })
  } catch (error) {
    return res.status(500).json({ error: "เปลี่ยนสถานะกลุ่มไม่สำเร็จ" })
  }
})

router.delete("/:id", protect, canManageGroups, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "เฉพาะ Superadmin เท่านั้นที่ลบกลุ่มได้" })
    }

    const group = await LineGroup.findById(req.params.id)
    if (!group) {
      return res.status(404).json({ error: "ไม่พบกลุ่ม" })
    }

    await group.deleteOne()

    return res.json({ message: "ลบกลุ่มสำเร็จ" })
  } catch (error) {
    return res.status(500).json({ error: "ลบกลุ่มไม่สำเร็จ" })
  }
})

module.exports = router