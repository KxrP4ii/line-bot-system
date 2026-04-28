const Log = require("../models/Log")

async function writeLog({
  actor = "system",
  action = "",
  targetType = "",
  targetId = "",
  details = ""
}) {
  try {
    await Log.create({
      actor,
      action,
      targetType,
      targetId: targetId ? String(targetId) : "",
      details
    })
  } catch (error) {
    console.error("writeLog error:", error.message)
  }
}

module.exports = { writeLog }