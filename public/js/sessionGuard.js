const SESSION_TIMEOUT_MS = 30 * 60 * 1000
let sessionTimer = null

function forceLogout() {
  localStorage.removeItem("token")
  localStorage.removeItem("user")
  window.location.replace("/login")
}

function resetSessionTimer() {
  clearTimeout(sessionTimer)
  sessionTimer = setTimeout(forceLogout, SESSION_TIMEOUT_MS)
}

async function checkSessionAlive() {
  const token = localStorage.getItem("token")
  if (!token) return forceLogout()

  try {
    const res = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    // 🔥 สำคัญมาก
    if (!res.ok) {
      return forceLogout()
    }
  } catch (error) {
    return forceLogout()
  }
}

function initSessionGuard() {
  const token = localStorage.getItem("token")
  if (!token) return

  ;["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(eventName => {
    window.addEventListener(eventName, resetSessionTimer)
  })

  resetSessionTimer()

  // 🔥 ลดเวลาเช็คให้เร็วขึ้น
  setInterval(checkSessionAlive, 10000)
}

document.addEventListener("DOMContentLoaded", initSessionGuard)