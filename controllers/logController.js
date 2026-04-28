const Log = require("../models/Log")
const Keyword = require("../models/Keyword")

exports.getLogs = async (req, res) => {
  try {
    if (!["approver", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" })
    }

    const { startDate, endDate } = req.query
    const filter = {}

    if (startDate || endDate) {
      filter.createdAt = {}

      if (startDate) {
        filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`)
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`)
      }
    }

    const logs = await Log.find(filter).sort({ createdAt: -1 })
    res.json(logs)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.getNotifications = async (req, res) => {
  try {
    let pendingCount = 0
    let rejectedCount = 0
    let approvedCount = 0
    let myPendingCount = 0

    if (["approver", "superadmin"].includes(req.user.role)) {
      pendingCount = await Keyword.countDocuments({ status: "pending" })
      approvedCount = await Keyword.countDocuments({ status: "approved" })
      rejectedCount = await Keyword.countDocuments({ status: "rejected" })
    }

    if (req.user.role === "editor") {
      rejectedCount = await Keyword.countDocuments({
        createdBy: req.user.username,
        status: "rejected"
      })

      myPendingCount = await Keyword.countDocuments({
        createdBy: req.user.username,
        status: "pending"
      })

      approvedCount = await Keyword.countDocuments({
        createdBy: req.user.username,
        status: "approved"
      })
    }

    let logFilter = {}

    if (req.user.role === "editor") {
      logFilter = {
        $or: [
          { actor: req.user.username },
          { details: { $regex: req.user.username, $options: "i" } }
        ]
      }
    }

    const latestLogs = await Log.find(logFilter)
      .sort({ createdAt: -1 })
      .limit(5)

    res.json({
      pendingCount,
      rejectedCount,
      approvedCount,
      myPendingCount,
      latestLogs
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}