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

router.get("/", protect, canManageUsers, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 })
    return res.json(users)
  } catch (error) {
    return res.status(500).json({ error: "โหลดผู้ใช้ไม่สำเร็จ" })
  }
})

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
        return res.status(403).json({ error: "เฉพาะ Superadmin คนแรกเท่านั้นที่สร้าง Superadmin ได้" })
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
      allowedGroups: Array.isArray(allowedGroups) ? allowedGroups.map(String) : [],
      sessionVersion: 0
    })

    return res.status(201).json({
      message: "สร้างผู้ใช้สำเร็จ",
      user: {
        _id: newUser._id,
        username: newUser.username,
        role: newUser.role,
        superadminLevel: newUser.superadminLevel,
        lineUserId: newUser.lineUserId,
        allowedGroups: newUser.allowedGroups
      }
    })
  } catch (error) {
    return res.status(500).json({ error: "สร้างผู้ใช้ไม่สำเร็จ" })
  }
})

router.put("/:id", protect, canManageUsers, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบ user" })
    }

    const { username, password, role, lineUserId, allowedGroups } = req.body
    const editingSelf = String(req.user._id) === String(targetUser._id)

    if (isApprover(req.user.role) && targetUser.role === "superadmin") {
      return res.status(403).json({ error: "Approver ไม่มีสิทธิ์แก้ไข Superadmin" })
    }

    if (editingSelf) {
      if (typeof allowedGroups !== "undefined") {
        if (!Array.isArray(allowedGroups)) {
          return res.status(400).json({ error: "allowedGroups ต้องเป็น array" })
        }

        targetUser.allowedGroups = allowedGroups.map(String)
      }

      if (typeof lineUserId !== "undefined") {
        targetUser.lineUserId = String(lineUserId || "").trim()
      }

      if (password && String(password).trim()) {
        targetUser.password = await bcrypt.hash(String(password), 10)
        targetUser.sessionVersion = Number(targetUser.sessionVersion || 0) + 1
      }

      await targetUser.save()

      return res.json({
        message: "อัปเดตผู้ใช้สำเร็จ",
        user: {
          _id: targetUser._id,
          username: targetUser.username,
          role: targetUser.role,
          superadminLevel: targetUser.superadminLevel,
          lineUserId: targetUser.lineUserId,
          allowedGroups: targetUser.allowedGroups
        }
      })
    }

    if (username && String(username).trim() !== targetUser.username) {
      const duplicate = await User.findOne({
        username: String(username).trim(),
        _id: { $ne: targetUser._id }
      })

      if (duplicate) {
        return res.status(400).json({ error: "Username นี้มีอยู่แล้ว" })
      }

      targetUser.username = String(username).trim()
    }

    if (typeof lineUserId !== "undefined") {
      targetUser.lineUserId = String(lineUserId || "").trim()
    }

    if (typeof allowedGroups !== "undefined") {
      if (!Array.isArray(allowedGroups)) {
        return res.status(400).json({ error: "allowedGroups ต้องเป็น array" })
      }

      targetUser.allowedGroups = allowedGroups.map(String)
    }

    if (password && String(password).trim()) {
      targetUser.password = await bcrypt.hash(String(password), 10)
      targetUser.sessionVersion = Number(targetUser.sessionVersion || 0) + 1
    }

    if (role) {
      if (isApprover(req.user.role)) {
        if (!["editor", "approver"].includes(role)) {
          return res.status(403).json({ error: "Approver เปลี่ยน role ได้เฉพาะ editor และ approver" })
        }

        targetUser.role = role
        targetUser.superadminLevel = 0
        targetUser.sessionVersion = Number(targetUser.sessionVersion || 0) + 1
      }

      if (isSuper(req.user.role)) {
        if (role === "superadmin") {
          if (targetUser.role !== "superadmin") {
            if (Number(req.user.superadminLevel || 0) !== 1) {
              return res.status(403).json({ error: "เฉพาะ Superadmin คนแรกเท่านั้นที่แต่งตั้ง Superadmin ได้" })
            }

            const superCount = await User.countDocuments({ role: "superadmin" })
            if (superCount >= 2) {
              return res.status(400).json({ error: "มี Superadmin ได้สูงสุด 2 คน" })
            }

            targetUser.role = "superadmin"
            targetUser.superadminLevel = 2
            targetUser.sessionVersion = Number(targetUser.sessionVersion || 0) + 1
          }
        } else {
          if (targetUser.role === "superadmin") {
            if (targetUser.superadminLevel === 1) {
              return res.status(403).json({ error: "ห้ามลดตำแหน่ง Superadmin คนแรก" })
            }

            if (Number(req.user.superadminLevel || 0) !== 1) {
              return res.status(403).json({ error: "เฉพาะ Superadmin คนแรกเท่านั้นที่ลดตำแหน่ง Superadmin ได้" })
            }
          }

          targetUser.role = role
          targetUser.superadminLevel = 0
          targetUser.sessionVersion = Number(targetUser.sessionVersion || 0) + 1
        }
      }
    }

    await targetUser.save()

    return res.json({
      message: "อัปเดตผู้ใช้สำเร็จ",
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        role: targetUser.role,
        superadminLevel: targetUser.superadminLevel,
        lineUserId: targetUser.lineUserId,
        allowedGroups: targetUser.allowedGroups
      }
    })
  } catch (error) {
    return res.status(500).json({ error: "อัปเดตผู้ใช้ไม่สำเร็จ" })
  }
})

router.put("/unlink-line/:id", protect, canManageUsers, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบ user" })
    }

    if (isApprover(req.user.role) && targetUser.role === "superadmin") {
      return res.status(403).json({ error: "Approver ไม่มีสิทธิ์แก้ไข Superadmin" })
    }

    targetUser.lineUserId = ""
    targetUser.sessionVersion = Number(targetUser.sessionVersion || 0) + 1

    await targetUser.save()

    return res.json({ message: "ยกเลิกการเชื่อม LINE สำเร็จ" })
  } catch (error) {
    return res.status(500).json({ error: "ยกเลิกการเชื่อม LINE ไม่สำเร็จ" })
  }
})

router.delete("/:id", protect, canManageUsers, async (req, res) => {
  try {
    if (!isSuper(req.user.role)) {
      return res.status(403).json({ error: "เฉพาะ Superadmin เท่านั้นที่ลบผู้ใช้ได้" })
    }

    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบ user" })
    }

    if (String(req.user._id) === String(targetUser._id)) {
      return res.status(403).json({ error: "ห้ามลบบัญชีตัวเอง" })
    }

    if (targetUser.role === "superadmin" && targetUser.superadminLevel === 1) {
      return res.status(403).json({ error: "ห้ามลบ Superadmin คนแรก" })
    }

    if (targetUser.role === "superadmin" && Number(req.user.superadminLevel || 0) !== 1) {
      return res.status(403).json({ error: "เฉพาะ Superadmin คนแรกเท่านั้นที่จัดการ Superadmin ได้" })
    }

    await targetUser.deleteOne()

    return res.json({ message: "ลบผู้ใช้สำเร็จ" })
  } catch (error) {
    return res.status(500).json({ error: "ลบผู้ใช้ไม่สำเร็จ" })
  }
})

module.exports = router