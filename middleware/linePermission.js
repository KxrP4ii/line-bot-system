const User = require("../models/User")
const LineGroup = require("../models/LineGroup")

async function checkLinePermission(event) {
  try {
    const source = event?.source || {}
    const lineUserId = source.userId || ""
    const groupId = source.groupId || ""

    if (!lineUserId) return false

    const user = await User.findOne({ lineUserId })

    if (!user) return false

    if (user.role === "superadmin") return true

    if (!groupId) return false

    const group = await LineGroup.findOne({ groupId })

    if (!group || !group.isActive) {
      return false
    }

    return Array.isArray(user.allowedGroups) && user.allowedGroups.includes(groupId)
  } catch (error) {
    console.error("checkLinePermission error:", error.message)
    return false
  }
}

module.exports = {
  checkLinePermission
}