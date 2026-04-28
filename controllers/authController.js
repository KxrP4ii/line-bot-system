const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const User = require("../models/User")
const { writeLog } = require("../services/logService")

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
      superadminLevel: Number(user.superadminLevel || 0),
      sessionVersion: Number(user.sessionVersion || 0)
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  )
}

exports.registerUser = async (req, res) => {
  try {
    const { username, password, role } = req.body

    if (!username || !password || !role) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" })
    }

    const normalizedUsername = String(username).trim()

    if (!["editor", "approver"].includes(role)) {
      return res.status(400).json({ error: "ไม่สามารถสร้าง role นี้ผ่าน register ได้" })
    }

    const existingUser = await User.findOne({ username: normalizedUsername })
    if (existingUser) {
      return res.status(400).json({ error: "Username นี้ถูกใช้แล้ว" })
    }

    const hashedPassword = await bcrypt.hash(String(password), 10)

    const user = await User.create({
      username: normalizedUsername,
      password: hashedPassword,
      role,
      superadminLevel: 0
    })

    await writeLog({
      actor: req.user?.username || "system",
      action: "REGISTER_USER",
      targetType: "user",
      targetId: user._id,
      details: `สร้างผู้ใช้ผ่าน register: ${user.username} | role: ${user.role}`
    })

    return res.status(201).json({
      message: "สร้างผู้ใช้สำเร็จ",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        superadminLevel: Number(user.superadminLevel || 0),
        lineUserId: user.lineUserId || "",
        allowedGroups: user.allowedGroups || [],
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: "กรุณากรอก username และ password" })
    }

    const user = await User.findOne({ username: String(username).trim() })
    if (!user) {
      return res.status(401).json({ error: "Username หรือ Password ไม่ถูกต้อง" })
    }

    const isMatch = await bcrypt.compare(String(password), user.password)
    if (!isMatch) {
      return res.status(401).json({ error: "Username หรือ Password ไม่ถูกต้อง" })
    }

    const token = signToken(user)

    await writeLog({
      actor: user.username,
      action: "LOGIN",
      targetType: "user",
      targetId: user._id,
      details: `เข้าสู่ระบบสำเร็จ | role: ${user.role} | superadminLevel: ${Number(user.superadminLevel || 0)}`
    })

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        superadminLevel: Number(user.superadminLevel || 0),
        lineUserId: user.lineUserId || "",
        allowedGroups: user.allowedGroups || []
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password")

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    return res.json({
      id: user._id,
      username: user.username,
      role: user.role,
      superadminLevel: Number(user.superadminLevel || 0),
      lineUserId: user.lineUserId || "",
      allowedGroups: user.allowedGroups || [],
      createdAt: user.createdAt
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}