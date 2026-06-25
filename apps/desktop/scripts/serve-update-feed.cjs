const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const releaseDir = path.join(projectRoot, 'release')
const port = Number(process.env.HORIZON_TRACKER_UPDATE_FEED_PORT || 8787)

const contentTypes = {
  '.yml': 'text/yaml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.blockmap': 'application/octet-stream',
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://127.0.0.1:${port}`)
  const pathname = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ''))
  const filePath = path.resolve(releaseDir, pathname)

  if (!filePath.startsWith(releaseDir)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404)
      response.end('Not found')
      return
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-store',
    })
    fs.createReadStream(filePath).pipe(response)
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Tracker update feed serving ${releaseDir}`)
  console.log(`Example feed URL: http://127.0.0.1:${port}/update-sim/1.0.1`)
})
