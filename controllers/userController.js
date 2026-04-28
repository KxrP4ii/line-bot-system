const bcrypt = require("bcryptjs")
const User = require("../models/User")
const { writeLog } = require("../services/logService")
const { emitAll } = require("../services/socketService")

function isAdmin(role) {
  return ["approver", "superadmin"].includes(role)
}

exports.getUsers = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "Access denied" })
    }

    const users = await User.find().select("-password").sort({ createdAt: -1 })
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.createUser = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "Access denied" })
    }

    const { username, password, role } = req.body

    if (!username || !password || !role) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" })
    }

    if (!["editor", "approver"].includes(role)) {
      return res.status(400).json({ error: "สร้างได้เฉพาะ editor หรือ approver" })
    }

    const existingUser = await User.findOne({ username: username.trim() })
    if (existingUser) {
      return res.status(400).json({ error: "Username นี้ถูกใช้แล้ว" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      username: username.trim(),
      password: hashedPassword,
      role
    })

    await writeLog({
      actor: req.user.username,
      action: "CREATE_USER",
      targetType: "user",
      targetId: user._id,
      details: `สร้างผู้ใช้: ${user.username} | role: ${user.role}`
    })

    emitAll({
      source: "users",
      action: "create-user",
      userId: String(user._id)
    })

    res.status(201).json({
      id: user._id,
      username: user.username,
      role: user.role,
      lineUserId: user.lineUserId || "",
      createdAt: user.createdAt
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.updateUser = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "Access denied" })
    }

    const { username, password, role } = req.body
    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้" })
    }

    const isSelf = String(targetUser._id) === String(req.user.id)

    if (targetUser.role === "superadmin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "ไม่สามารถแก้ไขบัญชี superadmin ได้" })
    }

    if (!username || !role) {
      return res.status(400).json({ error: "กรุณากรอก username และ role" })
    }

    if (!["editor", "approver", "superadmin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" })
    }

    if (req.user.role !== "superadmin" && role === "superadmin") {
      return res.status(403).json({ error: "เฉพาะ superadmin เท่านั้นที่กำหนด role นี้ได้" })
    }

    if (isSelf && req.user.role === "superadmin" && role !== "superadmin") {
      return res.status(400).json({ error: "superadmin ไม่สามารถเปลี่ยน role ของตัวเองได้" })
    }

    const superadminCount = await User.countDocuments({ role: "superadmin" })
    if (
      role === "superadmin" &&
      targetUser.role !== "superadmin" &&
      superadminCount >= 1
    ) {
      return res.status(400).json({ error: "ระบบมี superadmin ได้เพียง 1 คนเท่านั้น" })
    }

    const duplicate = await User.findOne({
      username: username.trim(),
      _id: { $ne: req.params.id }
    })

    if (duplicate) {
      return res.status(400).json({ error: "Username นี้ถูกใช้แล้ว" })
    }

    const beforeUsername = targetUser.username
    const beforeRole = targetUser.role

    targetUser.username = username.trim()
    targetUser.role = role

    if (password && password.trim()) {
      targetUser.password = await bcrypt.hash(password.trim(), 10)
    }

    await targetUser.save()

    await writeLog({
      actor: req.user.username,
      action: "UPDATE_USER",
      targetType: "user",
      targetId: targetUser._id,
      details: `แก้ไขผู้ใช้จาก ${beforeUsername} (${beforeRole}) เป็น ${targetUser.username} (${targetUser.role})`
    })

    emitAll({
      source: "users",
      action: "update-user",
      userId: String(targetUser._id)
    })

    res.json({
      id: targetUser._id,
      username: targetUser.username,
      role: targetUser.role,
      lineUserId: targetUser.lineUserId || "",
      createdAt: targetUser.createdAt
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.deleteUser = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "Access denied" })
    }

    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้" })
    }

    if (String(targetUser._id) === String(req.user.id)) {
      return res.status(400).json({ error: "ไม่สามารถลบบัญชีตัวเองได้" })
    }

    if (targetUser.role === "superadmin") {
      return res.status(403).json({ error: "ไม่สามารถลบบัญชี superadmin ได้" })
    }

    await User.findByIdAndDelete(req.params.id)

    await writeLog({
      actor: req.user.username,
      action: "DELETE_USER",
      targetType: "user",
      targetId: targetUser._id,
      details: `ลบผู้ใช้: ${targetUser.username} | role: ${targetUser.role}`
    })

    emitAll({
      source: "users",
      action: "delete-user",
      userId: String(targetUser._id)
    })

    res.json({ message: "ลบผู้ใช้สำเร็จ" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.unlinkLineUser = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "Access denied" })
    }

    const targetUser = await User.findById(req.params.id)

    if (!targetUser) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้" })
    }

    const isSelf = String(targetUser._id) === String(req.user.id)

    if (targetUser.role === "superadmin" && !isSelf) {
      return res.status(403).json({ error: "ไม่สามารถยกเลิกเชื่อม LINE ของ superadmin คนอื่นได้" })
    }

    if (!targetUser.lineUserId) {
      return res.status(400).json({ error: "ผู้ใช้นี้ยังไม่ได้เชื่อม LINE" })
    }

    const oldLineUserId = targetUser.lineUserId
    targetUser.lineUserId = ""
    await targetUser.save()

    await writeLog({
      actor: req.user.username,
      action: "UNLINK_LINE_USER",
      targetType: "user",
      targetId: targetUser._id,
      details: `ยกเลิกเชื่อม LINE ของผู้ใช้ ${targetUser.username} | lineUserId เดิม: ${oldLineUserId}`
    })

    emitAll({
      source: "users",
      action: "unlink-line",
      userId: String(targetUser._id)
    })

    res.json({
      message: "ยกเลิกเชื่อม LINE สำเร็จ",
      user: {
        id: targetUser._id,
        username: targetUser.username,
        role: targetUser.role,
        lineUserId: targetUser.lineUserId || "",
        createdAt: targetUser.createdAt
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}