const userMap = new Map()
const groupMap = new Map()
const keywordCooldownMap = new Map()
const muteMap = new Map()
const spamLogs = []

const USER_LIMIT = 5
const GROUP_LIMIT = 20
const WINDOW_MS = 10000
const KEYWORD_COOLDOWN_MS = 3000

const FIRST_MUTE_MS = 30 * 1000
const SECOND_MUTE_MS = 5 * 60 * 1000
const MAX_LOGS = 300

function now() {
  return Date.now()
}

function getMuteKey(userId, groupId) {
  return `${userId || "unknown"}:${groupId || "private"}`
}

function cleanupOldArray(history, windowMs) {
  const current = now()
  return history.filter((t) => current - t < windowMs)
}

function addSpamLog({ userId, groupId, keyword, reason, mute }) {
  spamLogs.unshift({
    userId: userId || "",
    groupId: groupId || "",
    keyword: keyword || "",
    reason: reason || "",
    muteLevel: mute?.level || 0,
    muteUntil: mute?.until || null,
    durationMs: mute?.durationMs || 0,
    createdAt: new Date().toISOString()
  })

  if (spamLogs.length > MAX_LOGS) {
    spamLogs.splice(MAX_LOGS)
  }
}

function isMuted(userId, groupId) {
  const key = getMuteKey(userId, groupId)
  const data = muteMap.get(key)

  if (!data) return false

  if (now() >= data.until) {
    muteMap.delete(key)
    return false
  }

  return true
}

function getMuteInfo(userId, groupId) {
  const key = getMuteKey(userId, groupId)
  const data = muteMap.get(key)

  if (!data) return null

  if (now() >= data.until) {
    muteMap.delete(key)
    return null
  }

  return data
}

function applyMute(userId, groupId) {
  const key = getMuteKey(userId, groupId)
  const current = now()
  const existing = muteMap.get(key)

  if (!existing) {
    const mute = {
      userId,
      groupId,
      level: 1,
      until: current + FIRST_MUTE_MS,
      durationMs: FIRST_MUTE_MS,
      reason: "spam-detected",
      createdAt: current
    }

    muteMap.set(key, mute)
    return mute
  }

  const nextLevel = existing.level >= 2 ? 2 : existing.level + 1
  const durationMs = nextLevel === 1 ? FIRST_MUTE_MS : SECOND_MUTE_MS

  const mute = {
    userId,
    groupId,
    level: nextLevel,
    until: current + durationMs,
    durationMs,
    reason: "spam-detected",
    createdAt: current
  }

  muteMap.set(key, mute)
  return mute
}

function checkUserLimit(userId) {
  if (!userId) return { ok: true }

  const current = now()
  const history = userMap.get(userId) || []
  const filtered = cleanupOldArray(history, WINDOW_MS)

  if (filtered.length >= USER_LIMIT) {
    userMap.set(userId, filtered)
    return { ok: false, reason: "user-rate-limit" }
  }

  filtered.push(current)
  userMap.set(userId, filtered)

  return { ok: true }
}

function checkGroupLimit(groupId) {
  if (!groupId) return { ok: true }

  const current = now()
  const history = groupMap.get(groupId) || []
  const filtered = cleanupOldArray(history, WINDOW_MS)

  if (filtered.length >= GROUP_LIMIT) {
    groupMap.set(groupId, filtered)
    return { ok: false, reason: "group-rate-limit" }
  }

  filtered.push(current)
  groupMap.set(groupId, filtered)

  return { ok: true }
}

function checkKeywordCooldown(groupId, keyword) {
  if (!groupId || !keyword) return { ok: true }

  const key = `${groupId}:${keyword}`
  const lastUsed = keywordCooldownMap.get(key) || 0
  const current = now()

  if (current - lastUsed < KEYWORD_COOLDOWN_MS) {
    return { ok: false, reason: "keyword-cooldown" }
  }

  keywordCooldownMap.set(key, current)
  return { ok: true }
}

function checkAllLimits({ userId, groupId, keyword }) {
  if (isMuted(userId, groupId)) {
    const mute = getMuteInfo(userId, groupId)

    const result = {
      ok: false,
      reason: "muted",
      mute
    }

    addSpamLog({ userId, groupId, keyword, reason: result.reason, mute })
    return result
  }

  const userCheck = checkUserLimit(userId)
  if (!userCheck.ok) {
    const mute = applyMute(userId, groupId)

    const result = {
      ok: false,
      reason: userCheck.reason,
      mute
    }

    addSpamLog({ userId, groupId, keyword, reason: result.reason, mute })
    return result
  }

  const groupCheck = checkGroupLimit(groupId)
  if (!groupCheck.ok) {
    const mute = applyMute(userId, groupId)

    const result = {
      ok: false,
      reason: groupCheck.reason,
      mute
    }

    addSpamLog({ userId, groupId, keyword, reason: result.reason, mute })
    return result
  }

  const keywordCheck = checkKeywordCooldown(groupId, keyword)
  if (!keywordCheck.ok) {
    const result = {
      ok: false,
      reason: keywordCheck.reason
    }

    addSpamLog({ userId, groupId, keyword, reason: result.reason })
    return result
  }

  return { ok: true }
}

function getActiveMutes() {
  const current = now()
  const rows = []

  for (const [key, data] of muteMap.entries()) {
    if (current >= data.until) {
      muteMap.delete(key)
      continue
    }

    rows.push({
      key,
      userId: data.userId || "",
      groupId: data.groupId || "",
      level: data.level,
      reason: data.reason,
      durationMs: data.durationMs,
      remainingMs: data.until - current,
      until: new Date(data.until).toISOString(),
      createdAt: new Date(data.createdAt).toISOString()
    })
  }

  return rows.sort((a, b) => b.remainingMs - a.remainingMs)
}

function getSpamLogs() {
  return spamLogs
}

function clearMute(userId, groupId) {
  const key = getMuteKey(userId, groupId)
  return muteMap.delete(key)
}

function clearAllMutes() {
  muteMap.clear()
  return true
}

function clearSpamLogs() {
  spamLogs.length = 0
  return true
}

module.exports = {
  checkAllLimits,
  isMuted,
  getMuteInfo,
  getActiveMutes,
  getSpamLogs,
  clearMute,
  clearAllMutes,
  clearSpamLogs
}