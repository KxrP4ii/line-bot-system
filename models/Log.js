const mongoose = require("mongoose")

const logSchema = new mongoose.Schema(
  {
    actor: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    },
    targetType: {
      type: String,
      default: ""
    },
    targetId: {
      type: String,
      default: ""
    },
    details: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("Log", logSchema)