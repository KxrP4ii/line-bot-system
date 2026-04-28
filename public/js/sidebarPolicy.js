function initSidebarPolicy(activePage) {
  const token = localStorage.getItem("token")
  let user = {}

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}")
  } catch {
    user = {}
  }

  if (!token || !user || !user.role) {
    localStorage.clear()
    window.location.replace("/login")
    return
  }

  const policy = {
    editor: ["dashboard"],
    approver: ["dashboard", "analytics", "groups", "users", "logs", "spam", "support"],
    superadmin: ["dashboard", "analytics", "groups", "users", "logs", "spam", "support", "cleanup"]
  }

  const allowedPages = policy[user.role] || []

  if (!allowedPages.includes(activePage)) {
    window.location.replace("/dashboard")
    return
  }

  const menus = [
    { id: "dashboardMenu", key: "dashboard" },
    { id: "analyticsMenu", key: "analytics" },
    { id: "groupsMenu", key: "groups" },
    { id: "usersMenu", key: "users" },
    { id: "logsMenu", key: "logs" },
    { id: "spamMenu", key: "spam" },
    { id: "supportMenu", key: "support" },
    { id: "cleanupMenu", key: "cleanup" }
  ]

  menus.forEach(menu => {
    const el = document.getElementById(menu.id)
    if (!el) return

    el.style.display = allowedPages.includes(menu.key) ? "block" : "none"

    if (menu.key === activePage) {
      el.classList.add("active")
    } else {
      el.classList.remove("active")
    }
  })

  const userInfo = document.getElementById("userInfo")

  if (userInfo) {
    userInfo.textContent = `${user.username || ""} (${user.role || ""})`
  }
}

function logout() {
  localStorage.clear()
  window.location.replace("/login")
}