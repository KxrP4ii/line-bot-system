const cron = require("node-cron")
const Keyword = require("../models/Keyword")
const User = require("../models/User")
const { notifyPendingReminder } = require("./lineNotifier")

let started = false

function startPendingReminderJob() {
  if (started) return
  started = true

  cron.schedule("0 */5 * * *", async () => {
    try {
      const pendingItems = await Keyword.find({ status: "pending" }).sort({ createdAt: 1 })
      if (!pendingItems.length) return

      const approvers = await User.find({
        role: { $in: ["approver", "superadmin"] },
        lineUserId: { $exists: true, $ne: "" }
      })

      if (!approvers.length) return

      const oldestPending = pendingItems[0]

      for (const approver of approvers) {
        await notifyPendingReminder(oldestPending, approver)
      }

      console.log(`Pending reminder sent to ${approvers.length} approver(s)`)
    } catch (error) {
      console.error("Pending reminder job error:", error.message)
    }
  })

  console.log("Pending reminder job started (every 5 hours)")
}

module.exports = {
  startPendingReminderJob
}