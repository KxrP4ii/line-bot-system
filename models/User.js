const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,

  sessionVersion: {
    type: Number,
    default: 0
  },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["editor", "approver", "superadmin"],
      default: "editor"
    },

    superadminLevel: {
      type: Number,
      enum: [0, 1, 2],
      default: 0
    },

    lineUserId: {
      type: String,
      default: "",
      trim: true
    },

    allowedGroups: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("User", userSchema)