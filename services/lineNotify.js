const line = require("@line/bot-sdk")
const User = require("../models/User")

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
})

async function pushText(to, text) {
  if (!to) return

  try {
    await client.pushMessage({
      to,
      messages: [
        {
          type: "text",
          text
        }
      ]
    })
  } catch (error) {
    console.error("LINE pushText error:", error?.body || error.message)
  }
}

async function notifyApprovers(text) {
  try {
    const approvers = await User.find({
      role: "approver",
      lineUserId: { $ne: "" }
    })

    for (const user of approvers) {
      await pushText(user.lineUserId, text)
    }
  } catch (error) {
    console.error("notifyApprovers error:", error.message)
  }
}

async function notifyUserByUsername(username, text) {
  try {
    if (!username) return

    const user = await User.findOne({ username })
    if (!user || !user.lineUserId) return

    await pushText(user.lineUserId, text)
  } catch (error) {
    console.error("notifyUserByUsername error:", error.message)
  }
}

module.exports = {
  pushText,
  notifyApprovers,
  notifyUserByUsername
}