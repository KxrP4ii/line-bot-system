const KeywordUsage = require("../models/KeywordUsage")

function isAdmin(role) {
  return ["approver", "superadmin"].includes(role)
}

exports.getAnalyticsSummary = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์ใช้งาน" })
    }

    const totalUsage = await KeywordUsage.countDocuments()

    const topGroups = await KeywordUsage.aggregate([
      {
        $match: {
          sourceType: "group",
          groupId: { $ne: "" }
        }
      },
      {
        $group: {
          _id: {
            groupId: "$groupId",
            groupName: "$groupName"
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          groupId: "$_id.groupId",
          groupName: "$_id.groupName",
          total: 1
        }
      }
    ])

    const topKeywords = await KeywordUsage.aggregate([
      {
        $group: {
          _id: "$keyword",
          total: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          keyword: "$_id",
          total: 1
        }
      }
    ])

    res.json({
      totalUsage,
      topGroups,
      topKeywords
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.getGroupKeywordStats = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์ใช้งาน" })
    }

    const { groupId } = req.params

    const stats = await KeywordUsage.aggregate([
      {
        $match: { groupId }
      },
      {
        $group: {
          _id: "$keyword",
          total: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          keyword: "$_id",
          total: 1
        }
      }
    ])

    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.getAnalyticsCharts = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์ใช้งาน" })
    }

    const days = Math.max(1, Math.min(90, Number(req.query.days) || 30))
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() - (days - 1))

    const dailyRaw = await KeywordUsage.aggregate([
      {
        $match: {
          usedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$usedAt"
            }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])

    const dailyMap = new Map(dailyRaw.map(item => [item._id, item.total]))
    const dailyUsage = []

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      const key = date.toISOString().slice(0, 10)

      dailyUsage.push({
        date: key,
        total: dailyMap.get(key) || 0
      })
    }

    const topKeywordsChart = await KeywordUsage.aggregate([
      {
        $match: {
          usedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$keyword",
          total: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 7 },
      {
        $project: {
          _id: 0,
          keyword: "$_id",
          total: 1
        }
      }
    ])

    const topGroupsChart = await KeywordUsage.aggregate([
      {
        $match: {
          usedAt: { $gte: startDate },
          sourceType: "group",
          groupId: { $ne: "" }
        }
      },
      {
        $group: {
          _id: {
            groupId: "$groupId",
            groupName: "$groupName"
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 7 },
      {
        $project: {
          _id: 0,
          groupId: "$_id.groupId",
          groupName: "$_id.groupName",
          total: 1
        }
      }
    ])

    res.json({
      days,
      dailyUsage,
      topKeywordsChart,
      topGroupsChart
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}