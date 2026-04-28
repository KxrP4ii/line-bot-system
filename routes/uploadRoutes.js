const express = require("express")
const multer = require("multer")

const { protect } = require("../middleware/authMiddleware")
const { uploadFile } = require("../services/cloudinaryService")

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
})

router.post("/", protect, upload.single("file"), async (req, res) => {
  try {
    if (!["editor", "approver", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์อัปโหลดไฟล์" })
    }

    if (!req.file) {
      return res.status(400).json({ error: "กรุณาเลือกไฟล์" })
    }

    const mimeType = req.file.mimetype || ""

    let mediaType = "none"

    if (mimeType.startsWith("image/")) {
      mediaType = "image"
    } else if (mimeType.startsWith("video/")) {
      mediaType = "video"
    } else {
      return res.status(400).json({ error: "รองรับเฉพาะรูปภาพหรือวิดีโอ" })
    }

    const uploaded = await uploadFile(req.file, mediaType)

    res.json({
      mediaType,
      mediaUrl: uploaded.secure_url || uploaded.url || "",
      mediaPublicId: uploaded.public_id || "",
      previewImageUrl: mediaType === "image" ? (uploaded.secure_url || uploaded.url || "") : ""
    })
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({ error: error.message || "อัปโหลดไฟล์ไม่สำเร็จ" })
  }
})

module.exports = router