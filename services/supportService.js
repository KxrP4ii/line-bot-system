const SupportTicket = require("../models/SupportTicket")
const SupportSetting = require("../models/SupportSetting")
const User = require("../models/User")

const GROUP_TICKET_COOLDOWN_MINUTES = 30

async function getSupportSetting() {
  let setting = await SupportSetting.findOne()

  if (!setting) {
    setting = await SupportSetting.create({})
  }

  return setting
}

async function notifyAdmins(lineClient, message) {
  if (!lineClient) return

  try {
    const admins = await User.find({
      role: { $in: ["approver", "superadmin"] },
      lineUserId: { $exists: true, $ne: "" }
    })

    for (const admin of admins) {
      try {
        await lineClient.pushMessage({
          to: admin.lineUserId,
          messages: [{ type: "text", text: message }]
        })
      } catch (error) {
        console.error("notify admin error:", error.message)
      }
    }
  } catch (error) {
    console.error("load admins error:", error.message)
  }
}

function includesAny(text = "", keywords = []) {
  const normalized = String(text || "").toLowerCase()
  return keywords.some(keyword => normalized.includes(String(keyword || "").toLowerCase()))
}

async function handleCustomerMessage({ groupId, groupName, userId, text, hasImage, lineClient }) {
  if (!groupId) return null

  const setting = await getSupportSetting()

  if (!setting.enabled) return null

  const supportKeywords = Array.isArray(setting.supportKeywords) ? setting.supportKeywords : []
  const cleaningKeywords = Array.isArray(setting.cleaningKeywords) ? setting.cleaningKeywords : []

  const cleanText = String(text || "").trim().toLowerCase()

  if (hasImage && !cleanText) return null

  const isSupport = includesAny(cleanText, supportKeywords)
  const isCleaning = includesAny(cleanText, cleaningKeywords)

  if (isCleaning && !isSupport) return null
  if (!isSupport) return null

  const existingOpenTicket = await SupportTicket.findOne({
    groupId,
    status: "open"
  }).sort({ createdAt: -1 })

  if (existingOpenTicket) {
    existingOpenTicket.message = cleanText || existingOpenTicket.message
    existingOpenTicket.hasImage = Boolean(existingOpenTicket.hasImage || hasImage)
    existingOpenTicket.lastCustomerMessageAt = new Date()
    await existingOpenTicket.save()
    return existingOpenTicket
  }

  const cooldownFrom = new Date(Date.now() - GROUP_TICKET_COOLDOWN_MINUTES * 60 * 1000)

  const recentTicket = await SupportTicket.findOne({
    groupId,
    createdAt: { $gte: cooldownFrom }
  }).sort({ createdAt: -1 })

  if (recentTicket) {
    recentTicket.message = cleanText || recentTicket.message
    recentTicket.hasImage = Boolean(recentTicket.hasImage || hasImage)
    recentTicket.lastCustomerMessageAt = new Date()
    await recentTicket.save()
    return recentTicket
  }

  const newTicket = await SupportTicket.create({
    groupId,
    groupName: groupName || "",
    customerUserId: userId || "",
    message: cleanText,
    hasImage: Boolean(hasImage),
    status: "open",
    lastCustomerMessageAt: new Date()
  })

  await notifyAdmins(
    lineClient,
    [
      "📢 มี Ticket ใหม่",
      `กลุ่ม: ${groupName || "-"}`,
      `ข้อความ: ${cleanText || "-"}`,
      "",
      "กรุณาตรวจสอบที่หน้า Support Tickets"
    ].join("\n")
  )

  return newTicket
}

async function handleTeamReply(groupId, systemUser) {
  if (!groupId || !systemUser) return

  await SupportTicket.updateMany(
    {
      groupId,
      status: { $in: ["open", "bot_replied"] }
    },
    {
      $set: {
        status: "closed",
        answeredBy: systemUser.username || "",
        answeredByRole: systemUser.role || "",
        answeredByLineUserId: systemUser.lineUserId || "",
        answeredAt: new Date(),
        closedAt: new Date()
      }
    }
  )
}

module.exports = {
  handleCustomerMessage,
  handleTeamReply
}