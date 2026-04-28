const mongoose = require("mongoose")

const lineGroupSchema = new mongoose.Schema(
  {
    groupId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    groupName: {
      type: String,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: false
    },

    lastSeenAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("LineGroup", lineGroupSchema)