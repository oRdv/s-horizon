const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const packageJson = require(path.join(projectRoot, 'package.json'))
const version = packageJson.version
const releaseDir = path.join(projectRoot, 'release')
const installerName = `Horizon-Boost-Tracker-Setup-${version}.exe`
const requiredFiles = [
  installerName,
  `${installerName}.blockmap`,
  'latest.yml',
]

let hasFailure = false

for (const filename of requiredFiles) {
  const filePath = path.join(releaseDir, filename)

  if (!fs.existsSync(filePath)) {
    console.error(`Missing release asset: ${path.relative(projectRoot, filePath)}`)
    hasFailure = true
    continue
  }

  const stats = fs.statSync(filePath)
  if (stats.size <= 0) {
    console.error(`Release asset is empty: ${path.relative(projectRoot, filePath)}`)
    hasFailure = true
  }
}

const latestPath = path.join(releaseDir, 'latest.yml')
const latest = fs.existsSync(latestPath) ? fs.readFileSync(latestPath, 'utf8') : ''

if (!latest.includes(`version: ${version}`)) {
  console.error(`latest.yml does not declare version ${version}`)
  hasFailure = true
}

if (!latest.includes(`url: ${installerName}`) || !latest.includes(`path: ${installerName}`)) {
  console.error(`latest.yml does not point to ${installerName}`)
  hasFailure = true
}

if (!latest.includes('sha512:')) {
  console.error('latest.yml does not include sha512 metadata')
  hasFailure = true
}

if (hasFailure) {
  process.exit(1)
}

console.log(`Release assets verified for ${version}: ${requiredFiles.join(', ')}`)
