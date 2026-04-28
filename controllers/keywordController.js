const Keyword = require("../models/Keyword")
const { writeLog } = require("../services/logService")
const { emitRefresh } = require("../services/socketService")
const { deleteMedia } = require("../services/cloudinaryService")
const {
  notifyApproversPending,
  notifyCreatorRejected,
  notifyCreatorApproved
} = require("../services/lineNotifier")

function isAdmin(role) {
  return ["approver", "superadmin"].includes(role)
}

exports.createKeyword = async (req, res) => {
  try {
    const {
      keyword,
      response,
      mediaType = "none",
      mediaUrl = "",
      mediaPublicId = "",
      previewImageUrl = ""
    } = req.body

    if (!keyword || !response) {
      return res.status(400).json({ error: "กรุณากรอก keyword และ response" })
    }

    const normalizedKeyword = keyword.trim().toLowerCase()

    const existing = await Keyword.findOne({ keyword: normalizedKeyword })
    if (existing) {
      return res.status(400).json({ error: "มี keyword นี้อยู่แล้ว" })
    }

    const adminMode = isAdmin(req.user.role)

    const newKeyword = await Keyword.create({
      keyword: normalizedKeyword,
      response: response.trim(),
      mediaType,
      mediaUrl,
      mediaPublicId,
      previewImageUrl,
      createdBy: req.user.username,
      status: adminMode ? "approved" : "pending",
      approvedBy: adminMode ? req.user.username : "",
      rejectedBy: "",
      rejectReason: "",
      usageCount: 0
    })

    await writeLog({
      actor: req.user.username,
      action: "CREATE_KEYWORD",
      targetType: "keyword",
      targetId: newKeyword._id,
      details: `สร้าง keyword: ${newKeyword.keyword} | status: ${newKeyword.status}`
    })

    if (!adminMode) {
      await notifyApproversPending(newKeyword)
    }

    emitRefresh("dashboard:refresh", {
      source: "dashboard",
      action: "create",
      keywordId: String(newKeyword._id)
    })

    res.status(201).json(newKeyword)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.getKeywords = async (req, res) => {
  try {
    let filter = {}

    if (req.user.role === "editor") {
      filter.createdBy = req.user.username
    }

    const keywords = await Keyword.find(filter).sort({ createdAt: -1 })
    res.json(keywords)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.updateKeyword = async (req, res) => {
  try {
    const keywordItem = await Keyword.findById(req.params.id)

    if (!keywordItem) {
      return res.status(404).json({ error: "ไม่พบข้อมูล" })
    }

    if (!isAdmin(req.user.role) && keywordItem.createdBy !== req.user.username) {
      return res.status(403).json({ error: "คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้" })
    }

    const {
      keyword,
      response,
      mediaType = "none",
      mediaUrl = "",
      mediaPublicId = "",
      previewImageUrl = ""
    } = req.body

    if (!keyword || !response) {
      return res.status(400).json({ error: "กรุณากรอก keyword และ response" })
    }

    const normalizedKeyword = keyword.trim().toLowerCase()

    const duplicate = await Keyword.findOne({
      keyword: normalizedKeyword,
      _id: { $ne: req.params.id }
    })

    if (duplicate) {
      return res.status(400).json({ error: "มี keyword นี้อยู่แล้ว" })
    }

    const oldMediaPublicId = keywordItem.mediaPublicId || ""
    const oldMediaType = keywordItem.mediaType || "none"

    const hasNewMedia =
      mediaPublicId &&
      mediaPublicId !== oldMediaPublicId

    const removeMedia =
      mediaType === "none" &&
      oldMediaPublicId

    keywordItem.keyword = normalizedKeyword
    keywordItem.response = response.trim()

    if (hasNewMedia) {
      keywordItem.mediaType = mediaType
      keywordItem.mediaUrl = mediaUrl
      keywordItem.mediaPublicId = mediaPublicId
      keywordItem.previewImageUrl = previewImageUrl || ""
    } else if (removeMedia) {
      keywordItem.mediaType = "none"
      keywordItem.mediaUrl = ""
      keywordItem.mediaPublicId = ""
      keywordItem.previewImageUrl = ""
    } else {
      keywordItem.mediaType = mediaType
      keywordItem.mediaUrl = mediaUrl
      keywordItem.mediaPublicId = mediaPublicId || oldMediaPublicId
      keywordItem.previewImageUrl = previewImageUrl || ""
    }

    if (isAdmin(req.user.role)) {
      keywordItem.status = "approved"
      keywordItem.approvedBy = req.user.username
      keywordItem.rejectedBy = ""
      keywordItem.rejectReason = ""
    } else {
      keywordItem.status = "pending"
      keywordItem.approvedBy = ""
      keywordItem.rejectedBy = ""
      keywordItem.rejectReason = ""
    }

    await keywordItem.save()

    if (hasNewMedia && oldMediaPublicId) {
      await deleteMedia(
        oldMediaPublicId,
        oldMediaType === "video" ? "video" : "image"
      )
    }

    if (removeMedia && oldMediaPublicId) {
      await deleteMedia(
        oldMediaPublicId,
        oldMediaType === "video" ? "video" : "image"
      )
    }

    await writeLog({
      actor: req.user.username,
      action: "UPDATE_KEYWORD",
      targetType: "keyword",
      targetId: keywordItem._id,
      details: `แก้ไข keyword: ${keywordItem.keyword} | status: ${keywordItem.status}`
    })

    if (!isAdmin(req.user.role)) {
      await notifyApproversPending(keywordItem)
    }

    emitRefresh("dashboard:refresh", {
      source: "dashboard",
      action: "update",
      keywordId: String(keywordItem._id)
    })

    res.json(keywordItem)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.deleteKeyword = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "เฉพาะผู้ยืนยันเท่านั้นที่ลบข้อมูลได้" })
    }

    const keywordItem = await Keyword.findById(req.params.id)

    if (!keywordItem) {
      return res.status(404).json({ error: "ไม่พบข้อมูล" })
    }

    if (keywordItem.mediaPublicId) {
      await deleteMedia(
        keywordItem.mediaPublicId,
        keywordItem.mediaType === "video" ? "video" : "image"
      )
    }

    await Keyword.findByIdAndDelete(req.params.id)

    await writeLog({
      actor: req.user.username,
      action: "DELETE_KEYWORD",
      targetType: "keyword",
      targetId: keywordItem._id,
      details: `ลบ keyword: ${keywordItem.keyword}`
    })

    emitRefresh("dashboard:refresh", {
      source: "dashboard",
      action: "delete",
      keywordId: String(keywordItem._id)
    })

    res.json({ message: "ลบข้อมูลสำเร็จ" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.approveKeyword = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "เฉพาะผู้ยืนยันเท่านั้นที่อนุมัติได้" })
    }

    const keywordItem = await Keyword.findById(req.params.id)

    if (!keywordItem) {
      return res.status(404).json({ error: "ไม่พบข้อมูล" })
    }

    keywordItem.status = "approved"
    keywordItem.approvedBy = req.user.username
    keywordItem.rejectedBy = ""
    keywordItem.rejectReason = ""

    await keywordItem.save()

    await writeLog({
      actor: req.user.username,
      action: "APPROVE_KEYWORD",
      targetType: "keyword",
      targetId: keywordItem._id,
      details: `อนุมัติ keyword: ${keywordItem.keyword}`
    })

    await notifyCreatorApproved(keywordItem)

    emitRefresh("dashboard:refresh", {
      source: "dashboard",
      action: "approve",
      keywordId: String(keywordItem._id)
    })

    res.json(keywordItem)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.rejectKeyword = async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ error: "เฉพาะผู้ยืนยันเท่านั้นที่ reject ได้" })
    }

    const { reason } = req.body

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "กรุณากรอกเหตุผลที่ reject" })
    }

    const keywordItem = await Keyword.findById(req.params.id)

    if (!keywordItem) {
      return res.status(404).json({ error: "ไม่พบข้อมูล" })
    }

    keywordItem.status = "rejected"
    keywordItem.rejectedBy = req.user.username
    keywordItem.rejectReason = reason.trim()
    keywordItem.approvedBy = ""

    await keywordItem.save()

    await writeLog({
      actor: req.user.username,
      action: "REJECT_KEYWORD",
      targetType: "keyword",
      targetId: keywordItem._id,
      details: `reject keyword: ${keywordItem.keyword} | เหตุผล: ${keywordItem.rejectReason}`
    })

    await notifyCreatorRejected(keywordItem)

    emitRefresh("dashboard:refresh", {
      source: "dashboard",
      action: "reject",
      keywordId: String(keywordItem._id)
    })

    res.json(keywordItem)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}