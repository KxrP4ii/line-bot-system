const express = require("express")
const multer = require("multer")
const fs = require("fs")
const path = require("path")

const { protect } = require("../middleware/authMiddleware")
const { uploadFile } = require("../services/cloudinaryService")

const router = express.Router()

const uploadDir = path.join(__dirname, "../uploads")

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "")
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  }
})

router.post("/", protect, upload.single("file"), async (req, res) => {
  let tempPath = ""

  try {
    if (!["editor", "approver", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์อัปโหลดไฟล์" })
    }

    if (!req.file) {
      return res.status(400).json({ error: "กรุณาเลือกไฟล์" })
    }

    tempPath = req.file.path

    const mimeType = req.file.mimetype || ""
    let mediaType = "none"

    if (mimeType.startsWith("image/")) {
      mediaType = "image"
    } else if (mimeType.startsWith("video/")) {
      mediaType = "video"
    } else {
      return res.status(400).json({ error: "รองรับเฉพาะรูปภาพหรือวิดีโอ" })
    }

    const uploaded = await uploadFile(tempPath, mediaType)

    res.json({
      mediaType,
      mediaUrl: uploaded.secure_url || uploaded.url || "",
      mediaPublicId: uploaded.public_id || "",
      previewImageUrl:
        mediaType === "image"
          ? uploaded.secure_url || uploaded.url || ""
          : ""
    })
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({
      error: error.message || "อัปโหลดไฟล์ไม่สำเร็จ"
    })
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath)
    }
  }
})

module.exports = router