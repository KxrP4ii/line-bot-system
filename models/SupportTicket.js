const mongoose = require("mongoose")

const supportTicketSchema = new mongoose.Schema(
  {
    groupId: {
      type: String,
      required: true,
      index: true
    },

    groupName: {
      type: String,
      default: ""
    },

    customerUserId: {
      type: String,
      default: ""
    },

    message: {
      type: String,
      default: ""
    },

    hasImage: {
      type: Boolean,
      default: false
    },

    status: {
      type: String,
      enum: ["open", "closed", "bot_replied"],
      default: "open",
      index: true
    },

    lastCustomerMessageAt: {
      type: Date,
      default: Date.now
    },

    closedAt: {
      type: Date
    },

    botRepliedAt: {
      type: Date
    },

    answeredBy: {
      type: String,
      default: ""
    },

    answeredByRole: {
      type: String,
      default: ""
    },

    answeredByLineUserId: {
      type: String,
      default: ""
    },

    answeredAt: {
      type: Date
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("SupportTicket", supportTicketSchema)