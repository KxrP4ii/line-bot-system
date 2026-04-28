const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")

const User = require("../models/User")
const { protect, canManageUsers } = require("../middleware/authMiddleware")

function isApprover(role) {
  return role === "approver"
}

function isSuper(role) {
  return role === "superadmin"
}

// ==========================
// GET USERS
// ==========================
router.get("/", protect, canManageUsers, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 })
    return res.json(users)
  } catch (error) {
    return res.status(500).json({ error: "โหลดผู้ใช้ไม่สำเร็จ" })
  }
})

// ==========================
// CREATE USER
// ==========================
router.post("/", protect, canManageUsers, async (req, res) => {
  try {
    if (!isSuper(req.user.role)) {
      return res.status(403).json({ error: "เฉพาะ Superadmin เท่านั้นที่สร้างผู้ใช้ได้" })
    }

    const { username, password, role, allowedGroups, lineUserId } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" })
    }

    const exists = await User.findOne({ username: String(username).trim() })
    if (exists) {
      return res.status(400).json({ error: "Username นี้มีอยู่แล้ว" })
    }

    let finalRole = role || "editor"
    let finalSuperadminLevel = 0

    if (finalRole === "superadmin") {
      if (Number(req.user.superadminLevel || 0) !== 1) {
        return res.status(403).json({ error: "เฉพาะ Superadmin คนแรกเท่านั้น" })
      }

      const superCount = await User.countDocuments({ role: "superadmin" })
      if (superCount >= 2) {
        return res.status(400).json({ error: "มี Superadmin ได้สูงสุด 2 คน" })
      }

      finalSuperadminLevel = 2
    }

    const hashedPassword = await bcrypt.hash(String(password), 10)

    const newUser = await User.create({
      username: String(username).trim(),
      password: hashedPassword,
      role: finalRole,
      superadminLevel: finalSuperadminLevel,
      lineUserId: String(lineUserId || "").trim(),
      allowedGroups: Array.isArray(allowedGroups) ? allowedGroups : [],
      sessionVersion: 0
    })

    return res.status(201).json({
      message: "สร้างผู้ใช้สำเร็จ",
      user: newUser
    })
  } catch (error) {
    return res.status(500).json({ error: "สร้างผู้ใช้ไม่สำเร็จ" })
  }
})

// ==========================
// UPDATE USER (🔥 สำคัญ)
// ==========================
router.put("/:id", protect, canManageUsers, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบ user" })
    }

    if (String(req.user._id) === String(targetUser._id)) {
      return res.status(403).json({ error: "ห้ามแก้ตัวเอง" })
    }

    const { username, password, role, lineUserId, allowedGroups } = req.body

    if (isApprover(req.user.role) && targetUser.role === "superadmin") {
      return res.status(403).json({ error: "Approver ไม่มีสิทธิ์แก้ Superadmin" })
    }

    if (username && String(username).trim() !== targetUser.username) {
      const duplicate = await User.findOne({
        username: String(username).trim(),
        _id: { $ne: targetUser._id }
      })

      if (duplicate) {
        return res.status(400).json({ error: "Username ซ้ำ" })
      }

      targetUser.username = String(username).trim()
    }

    if (typeof lineUserId !== "undefined") {
      targetUser.lineUserId = String(lineUserId || "").trim()
    }

    if (typeof allowedGroups !== "undefined") {
      targetUser.allowedGroups = Array.isArray(allowedGroups) ? allowedGroups : []
    }

    if (password && String(password).trim()) {
      targetUser.password = await bcrypt.hash(String(password), 10)
    }

    if (role) {
      targetUser.role = role
      targetUser.superadminLevel = 0
    }

    // 🔥 จุดสำคัญ (force logout)
    targetUser.sessionVersion = Number(targetUser.sessionVersion || 0) + 1

    await targetUser.save()

    return res.json({
      message: "อัปเดตผู้ใช้สำเร็จ",
      user: targetUser
    })
  } catch (error) {
    return res.status(500).json({ error: "อัปเดตผู้ใช้ไม่สำเร็จ" })
  }
})

// ==========================
// UNLINK LINE
// ==========================
router.put("/unlink-line/:id", protect, canManageUsers, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบ user" })
    }

    targetUser.lineUserId = ""

    // 🔥 force logout
    targetUser.sessionVersion = Number(targetUser.sessionVersion || 0) + 1

    await targetUser.save()

    return res.json({ message: "ยกเลิก LINE สำเร็จ" })
  } catch (error) {
    return res.status(500).json({ error: "ผิดพลาด" })
  }
})

// ==========================
// DELETE USER
// ==========================
router.delete("/:id", protect, canManageUsers, async (req, res) => {
  try {
    if (!isSuper(req.user.role)) {
      return res.status(403).json({ error: "เฉพาะ Superadmin เท่านั้น" })
    }

    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบ user" })
    }

    if (String(req.user._id) === String(targetUser._id)) {
      return res.status(403).json({ error: "ห้ามลบตัวเอง" })
    }

    await targetUser.deleteOne()

    return res.json({ message: "ลบสำเร็จ" })
  } catch (error) {
    return res.status(500).json({ error: "ลบไม่สำเร็จ" })
  }
})

module.exports = router