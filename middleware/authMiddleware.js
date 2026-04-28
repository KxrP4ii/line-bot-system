const jwt = require("jsonwebtoken")

exports.protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" })
    }

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = {
      id: decoded.id || decoded._id || "",
      _id: decoded.id || decoded._id || "",
      username: decoded.username || "",
      role: decoded.role || "editor",
      superadminLevel: Number(decoded.superadminLevel || 0)
    }

    next()
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" })
  }
}

exports.isAdmin = (req, res, next) => {
  if (!req.user || !["approver", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" })
  }
  next()
}

exports.isSuperadmin = (req, res, next) => {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin only" })
  }
  next()
}

exports.isSuperadminLevel1 = (req, res, next) => {
  if (
    !req.user ||
    req.user.role !== "superadmin" ||
    Number(req.user.superadminLevel || 0) !== 1
  ) {
    return res.status(403).json({ error: "Superadmin level 1 only" })
  }
  next()
}

exports.canManageUsers = (req, res, next) => {
  if (!req.user || !["approver", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "No permission to manage users" })
  }
  next()
}

exports.canManageGroups = (req, res, next) => {
  if (!req.user || !["approver", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "No permission to manage groups" })
  }
  next()
}

exports.canViewAnalytics = (req, res, next) => {
  if (!req.user || !["approver", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "No permission to view analytics" })
  }
  next()
}

exports.canViewLogs = (req, res, next) => {
  if (!req.user || !["approver", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "No permission to view logs" })
  }
  next()
}