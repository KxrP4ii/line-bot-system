const mongoose = require("mongoose")

const keywordUsageSchema = new mongoose.Schema(
  {
    keyword: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    userId: {
      type: String,
      default: ""
    },
    sourceType: {
      type: String,
      enum: ["user", "group", "room"],
      default: "user"
    },
    groupId: {
      type: String,
      default: ""
    },
    groupName: {
      type: String,
      default: "private"
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("KeywordUsage", keywordUsageSchema)