const line = require("@line/bot-sdk")
const User = require("../models/User")

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
})

function getDashboardUrl() {
  return process.env.DASHBOARD_URL || "http://localhost:5001/dashboard"
}

function buildTextMessage(text) {
  return {
    type: "text",
    text
  }
}

function buildPendingFlex(keywordItem) {
  return {
    type: "flex",
    altText: `มีรายการรออนุมัติ: ${keywordItem.keyword}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFF4E5",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "มีรายการรออนุมัติ",
            weight: "bold",
            size: "lg",
            color: "#B45309"
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
            text: `Keyword: ${keywordItem.keyword}`,
            weight: "bold",
            wrap: true,
            size: "md"
          },
          {
            type: "text",
            text: `ผู้สร้าง: ${keywordItem.createdBy || "-"}`,
            wrap: true,
            size: "sm",
            color: "#555555"
          },
          {
            type: "text",
            text: (keywordItem.response || "-").slice(0, 180),
            wrap: true,
            size: "sm",
            color: "#666666"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "uri",
              label: "เปิด Dashboard",
              uri: getDashboardUrl()
            }
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "ดูรายละเอียด",
              data: `action=view_detail&id=${keywordItem._id}`
            }
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#16A34A",
                height: "sm",
                action: {
                  type: "postback",
                  label: "Approve",
                  data: `action=approve&id=${keywordItem._id}`
                }
              },
              {
                type: "button",
                style: "primary",
                color: "#DC2626",
                height: "sm",
                action: {
                  type: "postback",
                  label: "Reject",
                  data: `action=reject_menu&id=${keywordItem._id}`
                }
              }
            ]
          }
        ]
      }
    }
  }
}

function buildApprovedFlex(keywordItem) {
  return {
    type: "flex",
    altText: `รายการของคุณถูกอนุมัติ: ${keywordItem.keyword}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#E8F7EC",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "อนุมัติเรียบร้อย",
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
            text: `Keyword: ${keywordItem.keyword}`,
            weight: "bold",
            wrap: true
          },
          {
            type: "text",
            text: `Approved by: ${keywordItem.approvedBy || "-"}`,
            size: "sm",
            color: "#555555",
            wrap: true
          }
        ]
      }
    }
  }
}

function buildRejectedFlex(keywordItem) {
  return {
    type: "flex",
    altText: `รายการของคุณถูกตีกลับ: ${keywordItem.keyword}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FDECEC",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "รายการถูกตีกลับ",
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
            text: `Keyword: ${keywordItem.keyword}`,
            weight: "bold",
            wrap: true
          },
          {
            type: "text",
            text: `Rejected by: ${keywordItem.rejectedBy || "-"}`,
            size: "sm",
            color: "#555555",
            wrap: true
          },
          {
            type: "text",
            text: `เหตุผล: ${keywordItem.rejectReason || "-"}`,
            size: "sm",
            color: "#B42318",
            wrap: true
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            action: {
              type: "uri",
              label: "กลับไปแก้ไข",
              uri: getDashboardUrl()
            }
          }
        ]
      }
    }
  }
}

function rejectReasonFlex(keywordId) {
  const reasons = [
    "ต้องแก้ไขรายละเอียด",
    "ข้อมูลยังไม่ครบถ้วน",
    "รูปแบบข้อความไม่เหมาะสม",
    "ลิงก์หรือสื่อไม่ถูกต้อง"
  ]

  return {
    type: "flex",
    altText: "เลือกเหตุผลในการ reject",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFF4E5",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "เลือกเหตุผลในการ Reject",
            weight: "bold",
            size: "lg",
            color: "#B45309"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: reasons.map(reason => ({
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "postback",
            label: reason,
            data: `action=reject&id=${keywordId}&reason=${encodeURIComponent(reason)}`
          }
        }))
      }
    }
  }
}

function detailFlex(keywordItem) {
  const hasImage =
    keywordItem.mediaType === "image" &&
    keywordItem.mediaUrl

  const hasVideo =
    keywordItem.mediaType === "video" &&
    keywordItem.mediaUrl

  let hero = null

  if (hasImage) {
    hero = {
      type: "image",
      url: keywordItem.mediaUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    }
  }

  if (hasVideo) {
    hero = {
      type: "video",
      url: keywordItem.mediaUrl,
      previewUrl: keywordItem.previewImageUrl || keywordItem.mediaUrl,
      altContent: {
        type: "image",
        url: keywordItem.previewImageUrl || "https://placehold.co/800x450?text=Video",
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      aspectRatio: "20:13"
    }
  }

  const bodyContents = [
    {
      type: "text",
      text: keywordItem.keyword || "-",
      weight: "bold",
      size: "xl",
      wrap: true
    },
    {
      type: "text",
      text: `Status: ${keywordItem.status || "-"}`,
      size: "sm",
      color: "#555555"
    },
    {
      type: "text",
      text: `Created by: ${keywordItem.createdBy || "-"}`,
      size: "sm",
      color: "#555555",
      wrap: true
    },
    {
      type: "text",
      text: `Media: ${keywordItem.mediaType || "none"}`,
      size: "xs",
      color: "#999999"
    },
    {
      type: "separator",
      margin: "md"
    },
    {
      type: "text",
      text: keywordItem.response || "-",
      wrap: true,
      size: "md"
    }
  ]

  if (keywordItem.rejectReason) {
    bodyContents.push({
      type: "separator",
      margin: "md"
    })
    bodyContents.push({
      type: "text",
      text: `Reject reason: ${keywordItem.rejectReason}`,
      wrap: true,
      size: "sm",
      color: "#B42318"
    })
  }

  const footerContents = []

  if (keywordItem.mediaUrl) {
    footerContents.push({
      type: "button",
      style: "link",
      height: "sm",
      action: {
        type: "uri",
        label: hasVideo ? "เปิดวิดีโอ" : "เปิดรูปภาพ",
        uri: keywordItem.mediaUrl
      }
    })
  } else {
    footerContents.push({
      type: "text",
      text: "ไม่มีไฟล์แนบ",
      size: "sm",
      color: "#999999"
    })
  }

  if (keywordItem.status === "pending") {
    footerContents.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#16A34A",
          height: "sm",
          action: {
            type: "postback",
            label: "Approve",
            data: `action=approve&id=${keywordItem._id}`
          }
        },
        {
          type: "button",
          style: "primary",
          color: "#DC2626",
          height: "sm",
          action: {
            type: "postback",
            label: "Reject",
            data: `action=reject_menu&id=${keywordItem._id}`
          }
        }
      ]
    })
  }

  return {
    type: "flex",
    altText: `รายละเอียด ${keywordItem.keyword}`,
    contents: {
      type: "bubble",
      size: "mega",
      ...(hero ? { hero } : {}),
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: bodyContents
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: footerContents
      }
    }
  }
}

async function pushSafe(to, messages) {
  try {
    if (!to) return false

    const normalized = Array.isArray(messages) ? messages : [messages]

    await client.pushMessage({
      to,
      messages: normalized
    })

    return true
  } catch (error) {
    console.error("LINE push error:", error.message)
    return false
  }
}

async function notifyApproversPending(keywordItem) {
  const approvers = await User.find({
    role: { $in: ["approver", "superadmin"] },
    lineUserId: { $exists: true, $ne: "" }
  })

  if (!approvers.length) {
    console.log("No approver/superadmin linked LINE for pending notification")
    return
  }

  for (const user of approvers) {
    await pushSafe(user.lineUserId, [buildPendingFlex(keywordItem)])
  }
}

async function notifyCreatorApproved(keywordItem) {
  if (!keywordItem.createdBy) return

  const creator = await User.findOne({
    username: keywordItem.createdBy,
    lineUserId: { $exists: true, $ne: "" }
  })

  if (!creator) return

  await pushSafe(creator.lineUserId, [buildApprovedFlex(keywordItem)])
}

async function notifyCreatorRejected(keywordItem) {
  if (!keywordItem.createdBy) return

  const creator = await User.findOne({
    username: keywordItem.createdBy,
    lineUserId: { $exists: true, $ne: "" }
  })

  if (!creator) return

  await pushSafe(creator.lineUserId, [buildRejectedFlex(keywordItem)])
}

async function notifyPendingReminder(keywordItem, approverUser) {
  if (!approverUser?.lineUserId) return false

  return await pushSafe(approverUser.lineUserId, [
    buildTextMessage("ยังมีรายการ pending รออนุมัติในระบบ"),
    buildPendingFlex(keywordItem)
  ])
}

module.exports = {
  notifyApproversPending,
  notifyCreatorApproved,
  notifyCreatorRejected,
  notifyPendingReminder,
  rejectReasonFlex,
  detailFlex
}