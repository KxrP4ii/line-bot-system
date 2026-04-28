const mongoose = require("mongoose")

const keywordSchema = new mongoose.Schema(
  {
    keyword: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    response: {
      type: String,
      required: true
    },
    mediaType: {
      type: String,
      enum: ["none", "image", "video"],
      default: "none"
    },
    mediaUrl: {
      type: String,
      default: ""
    },

    // เพิ่มตัวนี้สำหรับเก็บ Cloudinary public_id
    mediaPublicId: {
      type: String,
      default: ""
    },

    previewImageUrl: {
      type: String,
      default: ""
    },

    createdBy: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    approvedBy: {
      type: String,
      default: ""
    },

    rejectedBy: {
      type: String,
      default: ""
    },

    rejectReason: {
      type: String,
      default: ""
    },

    usageCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("Keyword", keywordSchema)