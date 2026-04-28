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

    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return forceLogout()
    }
  } catch (error) {
    console.warn("Session check failed")
  }
}

function initSessionGuard() {
  const token = localStorage.getItem("token")
  if (!token) return

  ;["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(eventName => {
    window.addEventListener(eventName, resetSessionTimer)
  })

  resetSessionTimer()

  setInterval(checkSessionAlive, 30 * 1000)
}

document.addEventListener("DOMContentLoaded", initSessionGuard)