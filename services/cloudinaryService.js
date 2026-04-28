const cloudinary = require("cloudinary").v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

async function uploadFile(filePath, folder = "line-bot") {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto"
    })

    return {
      url: result.secure_url,
      type: result.resource_type,
      publicId: result.public_id
    }
  } catch (error) {
    throw error
  }
}

async function deleteMedia(publicId, resourceType = "image") {
  try {
    if (!publicId) return null

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    })

    return result
  } catch (error) {
    console.error("Cloudinary delete error:", error.message)
    return null
  }
}

async function listResourcesByType(resourceType = "image", prefix = "line-bot") {
  let nextCursor = null
  const allResources = []

  do {
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: resourceType,
      prefix,
      max_results: 500,
      next_cursor: nextCursor || undefined
    })

    if (Array.isArray(result.resources)) {
      allResources.push(...result.resources)
    }

    nextCursor = result.next_cursor || null
  } while (nextCursor)

  return allResources
}

async function listManagedResources(prefix = "line-bot") {
  const [images, videos] = await Promise.all([
    listResourcesByType("image", prefix),
    listResourcesByType("video", prefix)
  ])

  return [
    ...images.map(item => ({
      public_id: item.public_id,
      resource_type: "image",
      secure_url: item.secure_url,
      bytes: item.bytes || 0,
      created_at: item.created_at || null
    })),
    ...videos.map(item => ({
      public_id: item.public_id,
      resource_type: "video",
      secure_url: item.secure_url,
      bytes: item.bytes || 0,
      created_at: item.created_at || null
    }))
  ]
}

module.exports = {
  uploadFile,
  deleteMedia,
  listManagedResources
}