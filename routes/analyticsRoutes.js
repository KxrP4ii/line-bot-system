const express = require("express")
const router = express.Router()
const ExcelJS = require("exceljs")

const KeywordUsage = require("../models/KeywordUsage")
const { protect, canViewAnalytics } = require("../middleware/authMiddleware")

function getStartDate(days) {
  const safeDays = Math.max(1, Number(days) || 30)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (safeDays - 1))
  return start
}

function formatDate(date) {
  if (!date) return "-"
  return new Date(date).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok"
  })
}

function formatDateOnlyFromGroup(item) {
  return `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`
}

function applyHeaderStyle(sheet) {
  const header = sheet.getRow(1)

  header.font = {
    bold: true,
    color: { argb: "FFFFFFFF" }
  }

  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }
  }

  header.alignment = {
    vertical: "middle",
    horizontal: "center"
  }

  header.eachCell(cell => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    }
  })

  sheet.views = [{ state: "frozen", ySplit: 1 }]
}

function applyBodyStyle(sheet) {
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    row.eachCell(cell => {
      cell.alignment = {
        vertical: "middle",
        wrapText: true
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } }
      }
    })
  })
}

router.get("/summary", protect, canViewAnalytics, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30
    const startDate = getStartDate(days)

    const [topGroups, topKeywords, totalUsageAgg, totalGroupsAgg, totalKeywordsAgg] = await Promise.all([
      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate }, sourceType: "group", groupId: { $ne: "" } } },
        { $group: { _id: "$groupId", total: { $sum: 1 }, groupName: { $last: "$groupName" } } },
        { $sort: { total: -1 } },
        { $limit: 20 },
        { $project: { _id: 0, groupId: "$_id", groupName: 1, total: 1 } }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        { $group: { _id: "$keyword", total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 20 },
        { $project: { _id: 0, keyword: "$_id", total: 1 } }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        { $group: { _id: null, totalUsage: { $sum: 1 } } }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate }, sourceType: "group", groupId: { $ne: "" } } },
        { $group: { _id: "$groupId" } },
        { $count: "totalGroups" }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        { $group: { _id: "$keyword" } },
        { $count: "totalKeywords" }
      ])
    ])

    return res.json({
      totalUsage: totalUsageAgg[0]?.totalUsage || 0,
      totalGroups: totalGroupsAgg[0]?.totalGroups || 0,
      totalKeywords: totalKeywordsAgg[0]?.totalKeywords || 0,
      topGroups,
      topKeywords
    })
  } catch (error) {
    return res.status(500).json({ error: "โหลด summary ไม่สำเร็จ" })
  }
})

router.get("/charts", protect, canViewAnalytics, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30
    const startDate = getStartDate(days)

    const [dailyUsage, topKeywordsChart, topGroupsChart, totalUsageAgg, totalGroupsAgg, totalKeywordsAgg] = await Promise.all([
      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: "$usedAt" },
              month: { $month: "$usedAt" },
              day: { $dayOfMonth: "$usedAt" }
            },
            total: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        { $group: { _id: "$keyword", total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, keyword: "$_id", total: 1 } }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate }, sourceType: "group", groupId: { $ne: "" } } },
        { $group: { _id: "$groupId", total: { $sum: 1 }, groupName: { $last: "$groupName" } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, groupId: "$_id", groupName: 1, total: 1 } }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        { $group: { _id: null, totalUsage: { $sum: 1 } } }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate }, sourceType: "group", groupId: { $ne: "" } } },
        { $group: { _id: "$groupId" } },
        { $count: "totalGroups" }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        { $group: { _id: "$keyword" } },
        { $count: "totalKeywords" }
      ])
    ])

    const formattedDailyUsage = dailyUsage.map(item => ({
      date: formatDateOnlyFromGroup(item),
      total: item.total
    }))

    return res.json({
      totalUsage: totalUsageAgg[0]?.totalUsage || 0,
      totalGroups: totalGroupsAgg[0]?.totalGroups || 0,
      totalKeywords: totalKeywordsAgg[0]?.totalKeywords || 0,
      dailyUsage: formattedDailyUsage,
      topKeywordsChart,
      topGroupsChart
    })
  } catch (error) {
    return res.status(500).json({ error: "โหลด charts ไม่สำเร็จ" })
  }
})

router.get("/group/:groupId", protect, canViewAnalytics, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30
    const startDate = getStartDate(days)
    const groupId = req.params.groupId

    const data = await KeywordUsage.aggregate([
      {
        $match: {
          usedAt: { $gte: startDate },
          sourceType: "group",
          groupId
        }
      },
      { $group: { _id: "$keyword", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $project: { _id: 0, keyword: "$_id", total: 1 } }
    ])

    return res.json(data)
  } catch (error) {
    return res.status(500).json({ error: "โหลดรายละเอียดกลุ่มไม่สำเร็จ" })
  }
})

router.get("/group-usage-table", protect, canViewAnalytics, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30
    const startDate = getStartDate(days)

    const rows = await KeywordUsage.aggregate([
      {
        $match: {
          usedAt: { $gte: startDate },
          sourceType: "group",
          groupId: { $ne: "" }
        }
      },
      {
        $group: {
          _id: { groupId: "$groupId", keyword: "$keyword" },
          total: { $sum: 1 },
          groupName: { $last: "$groupName" }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 100 },
      {
        $project: {
          _id: 0,
          groupId: "$_id.groupId",
          keyword: "$_id.keyword",
          groupName: 1,
          total: 1
        }
      }
    ])

    return res.json(rows)
  } catch (error) {
    return res.status(500).json({ error: "โหลดตาราง analytics ไม่สำเร็จ" })
  }
})

router.get("/export", protect, canViewAnalytics, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30
    const startDate = getStartDate(days)

    const [
      totalUsageAgg,
      totalGroupsAgg,
      totalKeywordsAgg,
      topGroups,
      topKeywords,
      groupKeywordDetailRows,
      dailyUsageRows,
      topUsers
    ] = await Promise.all([
      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        { $group: { _id: null, totalUsage: { $sum: 1 } } }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate }, sourceType: "group", groupId: { $ne: "" } } },
        { $group: { _id: "$groupId" } },
        { $count: "totalGroups" }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        { $group: { _id: "$keyword" } },
        { $count: "totalKeywords" }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate }, sourceType: "group", groupId: { $ne: "" } } },
        {
          $group: {
            _id: "$groupId",
            total: { $sum: 1 },
            groupName: { $last: "$groupName" },
            lastUsedAt: { $max: "$usedAt" }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 50 },
        {
          $project: {
            _id: 0,
            groupId: "$_id",
            groupName: 1,
            total: 1,
            lastUsedAt: 1
          }
        }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        {
          $group: {
            _id: "$keyword",
            total: { $sum: 1 },
            lastUsedAt: { $max: "$usedAt" }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 50 },
        {
          $project: {
            _id: 0,
            keyword: "$_id",
            total: 1,
            lastUsedAt: 1
          }
        }
      ]),

      KeywordUsage.aggregate([
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
              keyword: "$keyword"
            },
            total: { $sum: 1 },
            groupName: { $last: "$groupName" },
            lastUsedAt: { $max: "$usedAt" }
          }
        },
        { $sort: { "_id.groupId": 1, total: -1 } },
        {
          $project: {
            _id: 0,
            groupId: "$_id.groupId",
            keyword: "$_id.keyword",
            groupName: 1,
            total: 1,
            lastUsedAt: 1
          }
        }
      ]),

      KeywordUsage.aggregate([
        { $match: { usedAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: "$usedAt" },
              month: { $month: "$usedAt" },
              day: { $dayOfMonth: "$usedAt" }
            },
            total: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
      ]),

      KeywordUsage.aggregate([
        {
          $match: {
            usedAt: { $gte: startDate },
            userId: { $exists: true, $ne: "" }
          }
        },
        {
          $group: {
            _id: "$userId",
            total: { $sum: 1 },
            lastUsedAt: { $max: "$usedAt" }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 50 },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            total: 1,
            lastUsedAt: 1
          }
        }
      ])
    ])

    const groupTotalsMap = new Map()
    topGroups.forEach(group => {
      groupTotalsMap.set(group.groupId, group.total || 0)
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "LINE Bot Dashboard"
    workbook.created = new Date()

    const summarySheet = workbook.addWorksheet("Summary")
    summarySheet.columns = [
      { header: "รายการ", key: "label", width: 34 },
      { header: "ค่า", key: "value", width: 34 }
    ]

    summarySheet.addRows([
      { label: "ช่วงเวลารายงาน", value: `${days} วันล่าสุด` },
      { label: "วันที่เริ่มต้น", value: formatDate(startDate) },
      { label: "วันที่ Export", value: formatDate(new Date()) },
      { label: "Total Usage", value: totalUsageAgg[0]?.totalUsage || 0 },
      { label: "Total Groups", value: totalGroupsAgg[0]?.totalGroups || 0 },
      { label: "Total Keywords", value: totalKeywordsAgg[0]?.totalKeywords || 0 },
      { label: "Export By", value: req.user?.username || "-" }
    ])

    applyHeaderStyle(summarySheet)
    applyBodyStyle(summarySheet)

    const detailSheet = workbook.addWorksheet("Group Keyword Detail")
    detailSheet.columns = [
      { header: "ลำดับ", key: "rank", width: 10 },
      { header: "ชื่อกลุ่ม", key: "groupName", width: 34 },
      { header: "Group ID", key: "groupId", width: 48 },
      { header: "คีย์ที่ใช้", key: "keyword", width: 34 },
      { header: "จำนวนครั้ง", key: "total", width: 14 },
      { header: "% ในกลุ่ม", key: "percentInGroup", width: 14 },
      { header: "ใช้ล่าสุด", key: "lastUsedAt", width: 26 }
    ]

    detailSheet.addRows(
      groupKeywordDetailRows.map((item, index) => {
        const groupTotal = groupTotalsMap.get(item.groupId) || 0
        const percent = groupTotal > 0
          ? `${((Number(item.total || 0) / groupTotal) * 100).toFixed(1)}%`
          : "0%"

        return {
          rank: index + 1,
          groupName: item.groupName || "-",
          groupId: item.groupId || "-",
          keyword: item.keyword || "-",
          total: item.total || 0,
          percentInGroup: percent,
          lastUsedAt: formatDate(item.lastUsedAt)
        }
      })
    )

    applyHeaderStyle(detailSheet)
    applyBodyStyle(detailSheet)
    detailSheet.autoFilter = {
      from: "A1",
      to: "G1"
    }

    const topGroupsSheet = workbook.addWorksheet("Top Groups")
    topGroupsSheet.columns = [
      { header: "อันดับ", key: "rank", width: 10 },
      { header: "ชื่อกลุ่ม", key: "groupName", width: 34 },
      { header: "Group ID", key: "groupId", width: 48 },
      { header: "จำนวนครั้ง", key: "total", width: 14 },
      { header: "ใช้ล่าสุด", key: "lastUsedAt", width: 26 }
    ]

    topGroupsSheet.addRows(
      topGroups.map((item, index) => ({
        rank: index + 1,
        groupName: item.groupName || "-",
        groupId: item.groupId || "-",
        total: item.total || 0,
        lastUsedAt: formatDate(item.lastUsedAt)
      }))
    )

    applyHeaderStyle(topGroupsSheet)
    applyBodyStyle(topGroupsSheet)
    topGroupsSheet.autoFilter = {
      from: "A1",
      to: "E1"
    }

    const topKeywordsSheet = workbook.addWorksheet("Top Keywords")
    topKeywordsSheet.columns = [
      { header: "อันดับ", key: "rank", width: 10 },
      { header: "คีย์", key: "keyword", width: 38 },
      { header: "จำนวนครั้ง", key: "total", width: 14 },
      { header: "ใช้ล่าสุด", key: "lastUsedAt", width: 26 }
    ]

    topKeywordsSheet.addRows(
      topKeywords.map((item, index) => ({
        rank: index + 1,
        keyword: item.keyword || "-",
        total: item.total || 0,
        lastUsedAt: formatDate(item.lastUsedAt)
      }))
    )

    applyHeaderStyle(topKeywordsSheet)
    applyBodyStyle(topKeywordsSheet)
    topKeywordsSheet.autoFilter = {
      from: "A1",
      to: "D1"
    }

    const dailySheet = workbook.addWorksheet("Daily Usage")
    dailySheet.columns = [
      { header: "วันที่", key: "date", width: 18 },
      { header: "จำนวนครั้ง", key: "total", width: 16 }
    ]

    dailySheet.addRows(
      dailyUsageRows.map(item => ({
        date: formatDateOnlyFromGroup(item),
        total: item.total
      }))
    )

    applyHeaderStyle(dailySheet)
    applyBodyStyle(dailySheet)
    dailySheet.autoFilter = {
      from: "A1",
      to: "B1"
    }

    const topUsersSheet = workbook.addWorksheet("Top Users")
    topUsersSheet.columns = [
      { header: "อันดับ", key: "rank", width: 10 },
      { header: "LINE User ID", key: "userId", width: 48 },
      { header: "จำนวนครั้ง", key: "total", width: 14 },
      { header: "ใช้ล่าสุด", key: "lastUsedAt", width: 26 }
    ]

    topUsersSheet.addRows(
      topUsers.map((item, index) => ({
        rank: index + 1,
        userId: item.userId || "-",
        total: item.total || 0,
        lastUsedAt: formatDate(item.lastUsedAt)
      }))
    )

    applyHeaderStyle(topUsersSheet)
    applyBodyStyle(topUsersSheet)
    topUsersSheet.autoFilter = {
      from: "A1",
      to: "D1"
    }

    const fileName = `analytics_detail_${days}days_${Date.now()}.xlsx`

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    )

    await workbook.xlsx.write(res)
    return res.end()
  } catch (error) {
    console.error("export analytics error:", error)
    return res.status(500).json({ error: "Export Excel ไม่สำเร็จ" })
  }
})

module.exports = router