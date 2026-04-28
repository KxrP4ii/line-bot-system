let ioInstance = null

function setIO(io) {
  ioInstance = io
}

function getIO() {
  return ioInstance
}

function emitRefresh(channel = "dashboard:refresh", payload = {}) {
  if (!ioInstance) return

  ioInstance.emit(channel, {
    time: new Date().toISOString(),
    ...payload
  })
}

function emitAll(payload = {}) {
  emitRefresh("dashboard:refresh", payload)
  emitRefresh("users:refresh", payload)
  emitRefresh("logs:refresh", payload)
}

module.exports = {
  setIO,
  getIO,
  emitRefresh,
  emitAll
}