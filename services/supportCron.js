const SupportTicket = require("../models/SupportTicket")
const SupportSetting = require("../models/SupportSetting")
const User = require("../models/User")

async function notifyAdmins(lineClient, message) {
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

async function getSupportSetting() {
  let setting = await SupportSetting.findOne()

  if (!setting) {
    setting = await SupportSetting.create({
      enabled: true,
      reminderMinutes: 30,
      reminderText: "ขออภัยที่ให้รอนานครับ ทีมงานได้รับเรื่องแล้ว และจะรีบเข้ามาดูแลโดยเร็วที่สุดครับ 🙏"
    })
  }

  return setting
}

async function runSupportCron(lineClient) {
  try {
    const setting = await getSupportSetting()

    if (!setting.enabled) return

    const reminderMinutes = Number(setting.reminderMinutes || 30)
    const reminderText =
      setting.reminderText ||
      "ขออภัยที่ให้รอนานครับ ทีมงานได้รับเรื่องแล้ว และจะรีบเข้ามาดูแลโดยเร็วที่สุดครับ 🙏"

    const limit = new Date(Date.now() - reminderMinutes * 60 * 1000)

    const tickets = await SupportTicket.find({
      status: "open",
      lastCustomerMessageAt: { $lte: limit }
    }).limit(20)

    for (const ticket of tickets) {
      try {
        await lineClient.pushMessage({
          to: ticket.groupId,
          messages: [
            {
              type: "text",
              text: reminderText
            }
          ]
        })

        await notifyAdmins(
          lineClient,
          [
            `⚠️ เคสค้างเกิน ${reminderMinutes} นาที`,
            `กลุ่ม: ${ticket.groupName || "-"}`,
            `ข้อความล่าสุด: ${ticket.message || "-"}`,
            "",
            "บอทตอบแทนในกลุ่มแล้ว"
          ].join("\n")
        )

        ticket.status = "bot_replied"
        ticket.botRepliedAt = new Date()
        await ticket.save()
      } catch (error) {
        console.error("support reminder send error:", error.message)
      }
    }
  } catch (error) {
    console.error("runSupportCron error:", error.message)
  }
}

module.exports = runSupportCron