const express = require("express")
const router = express.Router()

const User = require("../models/User")
const { protect } = require("../middleware/authMiddleware")

// ==========================
// helper
// ==========================
function isApproverOrSuper(role) {
  return ["approver", "superadmin"].includes(role)
}

// ==========================
// GET all users
// ==========================
router.get("/", protect, async (req, res) => {
  try {
    if (!isApproverOrSuper(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์" })
    }

    const users = await User.find().select("-password")
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==========================
// UPDATE user
// ==========================
router.put("/:id", protect, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบ user" })
    }

    // ❌ ห้ามแก้ตัวเอง
    if (req.user._id.toString() === targetUser._id.toString()) {
      return res.status(403).json({ error: "ห้ามแก้ตัวเอง" })
    }

    // ❌ Approver ห้ามแตะ superadmin
    if (req.user.role === "approver" && targetUser.role === "superadmin") {
      return res.status(403).json({ error: "ห้ามแก้ Superadmin" })
    }

    const { role, allowedGroups, lineUserId } = req.body

    // ======================
    // 🔥 ROLE LOGIC
    // ======================
    if (role) {
      // ❌ Approver ห้ามตั้ง superadmin
      if (req.user.role === "approver" && role === "superadmin") {
        return res.status(403).json({ error: "ไม่มีสิทธิ์ตั้ง Superadmin" })
      }

      // 🔥 ตั้ง superadmin
      if (role === "superadmin") {
        // ต้องเป็น superadmin level 1 เท่านั้น
        if (
          req.user.role !== "superadmin" ||
          req.user.superadminLevel !== 1
        ) {
          return res.status(403).json({ error: "เฉพาะ Superadmin คนแรกเท่านั้น" })
        }

        const count = await User.countDocuments({ role: "superadmin" })

        if (count >= 2) {
          return res.status(400).json({ error: "มี Superadmin ได้สูงสุด 2 คน" })
        }

        targetUser.role = "superadmin"
        targetUser.superadminLevel = 2
      }

      // 🔥 ลดจาก superadmin
      else {
        if (targetUser.role === "superadmin") {
          // ❌ ห้ามลด level 1
          if (targetUser.superadminLevel === 1) {
            return res.status(403).json({ error: "ห้ามลด Superadmin คนแรก" })
          }

          // ต้องเป็น superadmin level 1
          if (
            req.user.role !== "superadmin" ||
            req.user.superadminLevel !== 1
          ) {
            return res.status(403).json({ error: "เฉพาะ Superadmin คนแรกเท่านั้น" })
          }
        }

        targetUser.role = role
        targetUser.superadminLevel = 0
      }
    }

    // ======================
    // groups
    // ======================
    if (allowedGroups) {
      targetUser.allowedGroups = allowedGroups
    }

    // ======================
    // unlink line
    // ======================
    if (lineUserId === "") {
      targetUser.lineUserId = ""
    }

    await targetUser.save()

    res.json({ message: "อัปเดตสำเร็จ" })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==========================
// CREATE user (เฉพาะ superadmin)
// ==========================
router.post("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "ไม่มีสิทธิ์" })
    }

    const { username, password } = req.body

    const user = await User.create({
      username,
      password,
      role: "editor"
    })

    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==========================
// DELETE user (เฉพาะ superadmin)
// ==========================
router.delete("/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "ไม่มีสิทธิ์" })
    }

    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({ error: "ไม่พบ user" })
    }

    // ❌ ห้ามลบ superadmin level 1
    if (user.role === "superadmin" && user.superadminLevel === 1) {
      return res.status(403).json({ error: "ห้ามลบ Superadmin คนแรก" })
    }

    await user.deleteOne()

    res.json({ message: "ลบสำเร็จ" })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router