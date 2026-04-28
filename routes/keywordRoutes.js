const express = require("express")
const router = express.Router()

const {
  createKeyword,
  getKeywords,
  updateKeyword,
  deleteKeyword,
  approveKeyword,
  rejectKeyword
} = require("../controllers/keywordController")

const { protect } = require("../middleware/authMiddleware")

router.get("/", protect, getKeywords)
router.post("/", protect, createKeyword)
router.put("/:id", protect, updateKeyword)
router.delete("/:id", protect, deleteKeyword)
router.post("/:id/approve", protect, approveKeyword)
router.post("/:id/reject", protect, rejectKeyword)

module.exports = router