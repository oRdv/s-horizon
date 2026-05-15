const { spawn } = require('node:child_process')
const electronPath = require('electron')

const env = { ...process.env }

delete env.ELECTRON_RUN_AS_NODE
env.VITE_DEV_SERVER_URL = env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5174'

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env,
  windowsHide: false,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
