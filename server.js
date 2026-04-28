require("dotenv").config()

const express = require("express")
const path = require("path")
const cors = require("cors")
const http = require("http")
const cron = require("node-cron")
const { Server } = require("socket.io")
const line = require("@line/bot-sdk")
const Fuse = require("fuse.js")

const connectDB = require("./config/db")
const Keyword = require("./models/Keyword")
const KeywordUsage = require("./models/KeywordUsage")
const User = require("./models/User")
const LineGroup = require("./models/LineGroup")

const { writeLog } = require("./services/logService")
const { startPendingReminderJob } = require("./services/pendingReminderJob")
const { setIO, emitAll } = require("./services/socketService")
const { checkAllLimits } = require("./services/rateLimitService")
const runSupportCron = require("./services/supportCron")
const {
  handleCustomerMessage,
  handleTeamReply
} = require("./services/supportService")

const {
  notifyCreatorApproved,
  notifyCreatorRejected,
  rejectReasonFlex,
  detailFlex
} = require("./services/lineNotifier")

const { checkLinePermission } = require("./middleware/linePermission")

const authRoutes = require("./routes/authRoutes")
const keywordRoutes = require("./routes/keywordRoutes")
const userRoutes = require("./routes/userRoutes")
const logRoutes = require("./routes/logRoutes")
const uploadRoutes = require("./routes/uploadRoutes")
const cleanupRoutes = require("./routes/cleanupRoutes")
const analyticsRoutes = require("./routes/analyticsRoutes")
const groupRoutes = require("./routes/groupRoutes")
const spamRoutes = require("./routes/spamRoutes")
const supportRoutes = require("./routes/supportRoutes")
const settingRoutes = require("./routes/settingRoutes")

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*"
  }
})

setIO(io)

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id)

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id)
  })
})

connectDB()

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
}

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
})

function buildTextMessage(text) {
  return {
    type: "text",
    text
  }
}

function isValidHttpsUrl(url) {
  return typeof url === "string" && /^https:\/\//i.test(String(url).trim())
}

async function getGroupNameSafe(groupId) {
  if (!groupId) return ""

  try {
    const group = await LineGroup.findOne({ groupId })
    if (group?.groupName) return group.groupName
  } catch (error) {}

  try {
    const summary = await client.getGroupSummary(groupId)
    return summary?.groupName || ""
  } catch (error) {
    return ""
  }
}

async function handleSupportTicketTracking(event) {
  try {
    const source = event?.source || {}
    const groupId = source.groupId || ""
    const lineUserId = source.userId || ""

    if (source.type !== "group" || !groupId || !lineUserId) return

    if (event.type !== "message") return

    const messageType = event.message?.type || ""
    const text = messageType === "text"
      ? String(event.message?.text || "").trim().toLowerCase()
      : ""

    const hasImage = messageType === "image"

    if (!text && !hasImage) return

    const systemUser = await User.findOne({ lineUserId })

    if (systemUser) {
    await handleTeamReply(groupId, systemUser)
    return
    }

    const groupName = await getGroupNameSafe(groupId)

    await handleCustomerMessage({
    groupId,
    groupName,
    userId: lineUserId, // ✅ แก้ตรงนี้
    text,
    hasImage,
    lineClient: client
})
  } catch (error) {
    console.error("support ticket tracking error:", error.message)
  }
}

async function upsertLineGroup(event) {
  try {
    const source = event?.source || {}
    const groupId = source.groupId || ""

    if (!groupId) return

    console.log("📥 upsertLineGroup:", {
      eventType: event?.type,
      sourceType: source.type || "",
      groupId
    })

    let groupName = ""

    try {
      const summary = await client.getGroupSummary(groupId)
      groupName = summary?.groupName || ""
      console.log("📛 group summary:", groupName || "(empty)")
    } catch (error) {
      console.log("⚠️ getGroupSummary failed:", error.message)
      groupName = ""
    }

    let group = await LineGroup.findOne({ groupId })

    if (!group) {
      group = await LineGroup.create({
        groupId,
        groupName,
        isActive: false,
        lastSeenAt: new Date()
      })

      console.log("🆕 New group saved:", groupId)

      await writeLog({
        actor: "line-bot",
        action: "AUTO_CREATE_GROUP",
        targetType: "group",
        targetId: group._id,
        details: `พบกลุ่มใหม่อัตโนมัติ ${groupName || "-"} | groupId=${groupId} | active=false`
      })

      emitAll({
        source: "groups",
        action: "new-group",
        groupId
      })

      return
    }

    group.groupName = groupName || group.groupName
    group.lastSeenAt = new Date()
    await group.save()

    console.log("♻️ Group updated:", groupId)

    emitAll({
      source: "groups",
      action: "seen",
      groupId
    })
  } catch (error) {
    console.error("upsertLineGroup error:", error)
  }
}

function buildApproveResultFlex(item) {
  const hasImage = item.mediaType === "image" && isValidHttpsUrl(item.mediaUrl)
  const hasVideo = item.mediaType === "video" && isValidHttpsUrl(item.mediaUrl)

  let hero = null

  if (hasImage) {
    hero = {
      type: "image",
      url: item.mediaUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    }
  }

  if (hasVideo) {
    hero = {
      type: "video",
      url: item.mediaUrl,
      previewUrl: item.previewImageUrl || item.mediaUrl,
      altContent: {
        type: "image",
        url: item.previewImageUrl || "https://placehold.co/800x450?text=Approved+Video",
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      aspectRatio: "20:13"
    }
  }

  return {
    type: "flex",
    altText: `อนุมัติแล้ว: ${item.keyword}`,
    contents: {
      type: "bubble",
      size: "mega",
      ...(hero ? { hero } : {}),
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#E8F7EC",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "อนุมัติสำเร็จ",
            weight: "bold",
            size: "lg",
            color: "#18794E"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: item.keyword || "-",
            weight: "bold",
            size: "xl",
            wrap: true
          },
          {
            type: "text",
            text: `Approved by: ${item.approvedBy || "-"}`,
            size: "sm",
            color: "#555555",
            wrap: true
          },
          {
            type: "text",
            text: item.response || "-",
            wrap: true,
            size: "sm"
          }
        ]
      }
    }
  }
}

function buildRejectResultFlex(item) {
  const hasImage = item.mediaType === "image" && isValidHttpsUrl(item.mediaUrl)
  const hasVideo = item.mediaType === "video" && isValidHttpsUrl(item.mediaUrl)

  let hero = null

  if (hasImage) {
    hero = {
      type: "image",
      url: item.mediaUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    }
  }

  if (hasVideo) {
    hero = {
      type: "video",
      url: item.mediaUrl,
      previewUrl: item.previewImageUrl || item.mediaUrl,
      altContent: {
        type: "image",
        url: item.previewImageUrl || "https://placehold.co/800x450?text=Rejected+Video",
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      aspectRatio: "20:13"
    }
  }

  return {
    type: "flex",
    altText: `ถูกตีกลับ: ${item.keyword}`,
    contents: {
      type: "bubble",
      size: "mega",
      ...(hero ? { hero } : {}),
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FDECEC",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "Reject สำเร็จ",
            weight: "bold",
            size: "lg",
            color: "#B42318"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: item.keyword || "-",
            weight: "bold",
            size: "xl",
            wrap: true
          },
          {
            type: "text",
            text: `Rejected by: ${item.rejectedBy || "-"}`,
            size: "sm",
            color: "#555555",
            wrap: true
          },
          {
            type: "text",
            text: `เหตุผล: ${item.rejectReason || "-"}`,
            wrap: true,
            size: "sm",
            color: "#B42318"
          }
        ]
      }
    }
  }
}

function buildImageFlex(item) {
  return {
    type: "flex",
    altText: item.response || item.keyword,
    contents: {
      type: "bubble",
      size: "mega",
      hero: {
        type: "image",
        url: item.mediaUrl,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: item.keyword,
            weight: "bold",
            size: "xl"
          },
          {
            type: "text",
            text: item.response,
            wrap: true,
            size: "md",
            color: "#555555"
          }
        ]
      }
    }
  }
}

function buildVideoFlex(item) {
  return {
    type: "flex",
    altText: item.response || item.keyword,
    contents: {
      type: "bubble",
      size: "mega",
      hero: {
        type: "video",
        url: item.mediaUrl,
        previewUrl: item.previewImageUrl || item.mediaUrl,
        altContent: {
          type: "image",
          url: item.previewImageUrl || "https://placehold.co/800x450?text=Video",
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover"
        },
        aspectRatio: "20:13"
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: item.keyword,
            weight: "bold",
            size: "xl"
          },
          {
            type: "text",
            text: item.response,
            wrap: true,
            size: "md",
            color: "#555555"
          }
        ]
      }
    }
  }
}

function buildReplyMessages(item) {
  if (!item) return []

  if (item.mediaType === "image" && isValidHttpsUrl(item.mediaUrl)) {
    return [buildImageFlex(item)]
  }

  if (item.mediaType === "video" && isValidHttpsUrl(item.mediaUrl)) {
    return [buildVideoFlex(item)]
  }

  return [buildTextMessage(item.response)]
}

function parsePostbackData(data = "") {
  const params = new URLSearchParams(data)
  return {
    action: params.get("action"),
    id: params.get("id"),
    reason: params.get("reason") ? decodeURIComponent(params.get("reason")) : ""
  }
}

async function handlePostbackEvent(event) {
  try {
    const data = event.postback?.data || ""
    const { action, id, reason } = parsePostbackData(data)
    const lineUserId = event.source?.userId || ""

    if (!action || !id || !lineUserId) {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [buildTextMessage("ข้อมูล postback ไม่ถูกต้อง")]
      })
      return
    }

    const approverUser = await User.findOne({
      lineUserId,
      role: { $in: ["approver", "superadmin"] }
    })

    if (!approverUser) {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [buildTextMessage("บัญชี LINE นี้ไม่มีสิทธิ์อนุมัติรายการ")]
      })
      return
    }

    const keywordItem = await Keyword.findById(id)

    if (!keywordItem) {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [buildTextMessage("ไม่พบรายการนี้ในระบบ")]
      })
      return
    }

    if (action === "view_detail") {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [detailFlex(keywordItem)]
      })
      return
    }

    if (action === "approve") {
      keywordItem.status = "approved"
      keywordItem.approvedBy = approverUser.username
      keywordItem.rejectedBy = ""
      keywordItem.rejectReason = ""
      await keywordItem.save()

      await notifyCreatorApproved(keywordItem)

      emitAll({
        source: "line",
        action: "approve",
        keywordId: String(keywordItem._id)
      })

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [buildApproveResultFlex(keywordItem)]
      })
      return
    }

    if (action === "reject_menu") {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [rejectReasonFlex(keywordItem._id)]
      })
      return
    }

    if (action === "reject") {
      const rejectReason = reason || "Rejected from LINE"

      keywordItem.status = "rejected"
      keywordItem.approvedBy = ""
      keywordItem.rejectedBy = approverUser.username
      keywordItem.rejectReason = rejectReason
      await keywordItem.save()

      await notifyCreatorRejected(keywordItem)

      emitAll({
        source: "line",
        action: "reject",
        keywordId: String(keywordItem._id)
      })

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [buildRejectResultFlex(keywordItem)]
      })
      return
    }

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [buildTextMessage("ไม่รู้จัก action นี้")]
    })
  } catch (error) {
    console.error("Postback error:", error.message)

    try {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [buildTextMessage("เกิดข้อผิดพลาดในการประมวลผล")]
      })
    } catch (replyError) {
      console.error("reply error:", replyError.message)
    }
  }
}

app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))
app.use(express.static(path.join(__dirname, "public")))

app.post("/webhook", line.middleware(lineConfig), async (req, res) => {
  try {
    const events = req.body.events || []

    console.log("📨 webhook events:", events.length)

    for (const event of events) {
      console.log("➡️ event:", {
        type: event?.type,
        sourceType: event?.source?.type,
        groupId: event?.source?.groupId || "",
        userId: event?.source?.userId || ""
      })

      await upsertLineGroup(event)
      await handleSupportTicketTracking(event)

      if (event.type === "join") {
        console.log("🤖 bot joined group:", event?.source?.groupId || "")
        continue
      }

      if (event.type === "postback") {
        await handlePostbackEvent(event)
        continue
      }

      if (event.type !== "message" || event.message.type !== "text") {
        continue
      }

      const rawText = (event.message.text || "").trim()
      const userText = rawText.toLowerCase()

      if (!userText) continue

      if (userText.startsWith("link ")) {
        const username = rawText.slice(5).trim()
        const lineUserId = event.source?.userId || ""

        if (!username) {
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [buildTextMessage("กรุณาพิมพ์: link ชื่อผู้ใช้")]
          })
          continue
        }

        if (!lineUserId) {
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [buildTextMessage("ไม่พบ LINE User ID สำหรับการผูกบัญชี")]
          })
          continue
        }

        const user = await User.findOne({ username })

        if (!user) {
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [buildTextMessage("ไม่พบชื่อผู้ใช้นี้ในระบบ")]
          })
          continue
        }

        user.lineUserId = lineUserId
        await user.save()

        await writeLog({
          actor: user.username,
          action: "LINK_LINE_ACCOUNT",
          targetType: "user",
          targetId: user._id,
          details: `ผูกบัญชี LINE สำเร็จ | lineUserId: ${lineUserId}`
        })

        emitAll({
          source: "line",
          action: "link-line",
          userId: String(user._id)
        })

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [buildTextMessage(`ผูก LINE สำเร็จสำหรับผู้ใช้ ${username}`)]
        })
        continue
      }

      if (event.source.type !== "group") {
        continue
      }

      const command = userText.startsWith("/")
        ? userText.slice(1).trim()
        : userText.trim()

      if (!command) continue

      const antiSpamResult = checkAllLimits({
        userId: event.source?.userId || "",
        groupId: event.source?.groupId || "",
        keyword: command
      })

      if (!antiSpamResult.ok) {
        if (antiSpamResult.mute) {
          console.log("🔇 auto mute triggered:", {
            userId: event.source?.userId || "",
            groupId: event.source?.groupId || "",
            level: antiSpamResult.mute.level,
            durationMs: antiSpamResult.mute.durationMs,
            reason: antiSpamResult.reason
          })
        } else {
          console.log("⛔ anti-spam blocked:", {
            userId: event.source?.userId || "",
            groupId: event.source?.groupId || "",
            reason: antiSpamResult.reason
          })
        }

        continue
      }

      const allowed = await checkLinePermission(event)
      if (!allowed) {
        continue
      }

      if (command === "help") {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            buildTextMessage(
              "คำสั่งที่ใช้ได้:\n/help\n/list\nหรือพิมพ์ชื่อคีย์เวิร์ดได้เลย\n\nผูกบัญชี LINE:\nlink ชื่อผู้ใช้"
            )
          ]
        })
        continue
      }

      if (command === "list") {
        const approvedKeywords = await Keyword.find(
          { status: "approved" },
          { keyword: 1, _id: 0 }
        ).sort({ keyword: 1 })

        const keywordList = approvedKeywords.map(item => item.keyword)

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            buildTextMessage(
              keywordList.length
                ? `รายการคำสั่ง:\n${keywordList.join("\n")}`
                : "ยังไม่มีคำสั่งที่อนุมัติแล้ว"
            )
          ]
        })
        continue
      }

      const approvedKeywords = await Keyword.find({ status: "approved" })

      const exactMatch = approvedKeywords.find(
        item => item.keyword.toLowerCase().trim() === command
      )

      let bestMatch = exactMatch || null

      if (!bestMatch) {
        const fuse = new Fuse(approvedKeywords, {
          keys: ["keyword"],
          threshold: 0.4
        })

        const results = fuse.search(command)
        bestMatch = results.length > 0 ? results[0].item : null
      }

      if (!bestMatch) {
        continue
      }

      bestMatch.usageCount += 1
      await bestMatch.save()

      let sourceType = event.source?.type || "user"
      let groupId = ""
      let groupName = "private"
      const userId = event.source?.userId || ""

      if (sourceType === "group") {
        groupId = event.source?.groupId || ""

        if (groupId) {
          try {
            const summary = await client.getGroupSummary(groupId)
            groupName = summary?.groupName || "unknown-group"
          } catch (error) {
            groupName = "unknown-group"
          }
        }
      } else if (sourceType === "room") {
        groupName = "room"
      }

      await KeywordUsage.create({
        keyword: bestMatch.keyword,
        userId,
        sourceType,
        groupId,
        groupName,
        usedAt: new Date()
      })

      emitAll({
        source: "line",
        action: "usage",
        keywordId: String(bestMatch._id)
      })

      const messages = buildReplyMessages(bestMatch)
      if (!messages.length) continue

      await client.replyMessage({
        replyToken: event.replyToken,
        messages
      })
    }

    res.sendStatus(200)
  } catch (error) {
    console.error("Webhook error:", error)
    res.sendStatus(500)
  }
})

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use("/api/auth", authRoutes)
app.use("/api/keywords", keywordRoutes)
app.use("/api/users", userRoutes)
app.use("/api/logs", logRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/cleanup", cleanupRoutes)
app.use("/api/analytics", analyticsRoutes)
app.use("/api/groups", groupRoutes)
app.use("/api/spam", spamRoutes)
app.use("/api/support", supportRoutes)
app.use("/api/settings", settingRoutes)

app.get("/", (req, res) => {
  res.redirect("/dashboard")
})

app.get("/login", (req, res) => {
  res.render("login")
})

app.get("/register", (req, res) => {
  res.render("register")
})

app.get("/dashboard", (req, res) => {
  res.render("dashboard")
})

app.get("/analytics", (req, res) => {
  res.render("analytics")
})

app.get("/groups", (req, res) => {
  res.render("groups")
})

app.get("/users", (req, res) => {
  res.render("users")
})

app.get("/logs", (req, res) => {
  res.render("logs")
})

app.get("/spam", (req, res) => {
  res.render("spam")
})

app.get("/cleanup", (req, res) => {
  res.render("cleanup")
})

app.get("/support", (req, res) => {
  res.render("support")
})

startPendingReminderJob()

cron.schedule("*/1 * * * *", async () => {
  try {
    await runSupportCron(client)
  } catch (error) {
    console.error("support cron error:", error.message)
  }
})

const PORT = process.env.PORT || 5001

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})