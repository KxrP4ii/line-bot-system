const express = require("express")
const router = express.Router()

const Keyword = require("../models/Keyword")
const { protect } = require("../middleware/authMiddleware")
const { writeLog } = require("../services/logService")
const { emitAll } = require("../services/socketService")
const {
  listManagedResources,
  deleteMedia
} = require("../services/cloudinaryService")

function isAdmin(role) {
  return ["approver", "superadmin"].includes(role)
}

// ==========================
// 🔍 GET: ดู orphan media
// ==========================
router.get("/orphan-media", protect, async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์ใช้งาน" })
    }

    const usedPublicIds = await Keyword.distinct("mediaPublicId", {
      mediaPublicId: { $exists: true, $ne: "" }
    })

    const usedSet = new Set(usedPublicIds)
    const resources = await listManagedResources("line-bot")
    const orphans = resources.filter(item => !usedSet.has(item.public_id))
    const orphanBytes = orphans.reduce((sum, item) => sum + (item.bytes || 0), 0)

    return res.json({
      totalCloudinaryFiles: resources.length,
      totalUsedInDb: usedPublicIds.length,
      orphanCount: orphans.length,
      orphanBytes,
      orphans
    })
  } catch (error) {
    console.error("Orphan check error:", error.message)

    return res.status(500).json({
      error: "ตรวจสอบ orphan ไม่สำเร็จ"
    })
  }
})

// ==========================
// 🔥 POST: ลบ orphan จริง
// ==========================
router.post("/orphan-media", protect, async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์ใช้งาน" })
    }

    const usedPublicIds = await Keyword.distinct("mediaPublicId", {
      mediaPublicId: { $exists: true, $ne: "" }
    })

    const usedSet = new Set(usedPublicIds)
    const resources = await listManagedResources("line-bot")
    const orphans = resources.filter(item => !usedSet.has(item.public_id))

    const deleted = []
    const failed = []

    for (const item of orphans) {
      try {
        const result = await deleteMedia(
          item.public_id,
          item.resource_type
        )

        if (result && (result.result === "ok" || result.result === "not found")) {
          deleted.push({
            public_id: item.public_id,
            resource_type: item.resource_type,
            bytes: item.bytes || 0
          })
        } else {
          failed.push({
            public_id: item.public_id,
            resource_type: item.resource_type,
            reason: result?.result || "unknown"
          })
        }
      } catch (err) {
        failed.push({
          public_id: item.public_id,
          resource_type: item.resource_type,
          reason: err.message
        })
      }
    }

    const deletedBytes = deleted.reduce((sum, item) => sum + (item.bytes || 0), 0)

    await writeLog({
      actor: req.user.username,
      action: "CLEANUP_ORPHAN_MEDIA",
      targetType: "cloudinary",
      targetId: "",
      details: `ลบ orphan media แล้ว ${deleted.length} ไฟล์ | ล้มเหลว ${failed.length} ไฟล์ | reclaimed ${deletedBytes} bytes`
    })

    emitAll({
      source: "cleanup",
      action: "cleanup-orphan-media",
      deletedCount: deleted.length
    })

    return res.json({
      message: "cleanup เสร็จแล้ว",
      scanned: resources.length,
      orphanCount: orphans.length,
      deletedCount: deleted.length,
      failedCount: failed.length,
      deletedBytes,
      deleted,
      failed
    })
  } catch (error) {
    console.error("Cleanup error:", error.message)

    return res.status(500).json({
      error: "cleanup ไม่สำเร็จ"
    })
  }
})

module.exports = router