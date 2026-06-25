const childProcess = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const packagePath = path.join(projectRoot, 'package.json')
const releaseDir = path.join(projectRoot, 'release')
const targetVersion = process.argv[2]

if (!targetVersion || !/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(targetVersion)) {
  console.error('Usage: node scripts/stage-update-candidate.cjs 1.0.1')
  process.exit(1)
}

async function main() {
  const originalPackage = await fs.readFile(packagePath, 'utf8')
  const packageJson = JSON.parse(originalPackage)
  const originalVersion = packageJson.version
  const originalInstaller = `Horizon-Boost-Tracker-Setup-${originalVersion}.exe`
  const targetInstaller = `Horizon-Boost-Tracker-Setup-${targetVersion}.exe`
  const simulationRoot = path.join(releaseDir, 'update-sim')

  await fs.mkdir(path.join(simulationRoot, originalVersion), { recursive: true })
  await copyIfExists(path.join(releaseDir, originalInstaller), path.join(simulationRoot, originalVersion, originalInstaller))
  await copyIfExists(path.join(releaseDir, `${originalInstaller}.blockmap`), path.join(simulationRoot, originalVersion, `${originalInstaller}.blockmap`))
  await copyIfExists(path.join(releaseDir, 'latest.yml'), path.join(simulationRoot, originalVersion, 'latest.yml'))

  packageJson.version = targetVersion
  await fs.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')

  try {
    run('npm', ['run', 'dist:win'])
    await fs.mkdir(path.join(simulationRoot, targetVersion), { recursive: true })
    await fs.copyFile(path.join(releaseDir, targetInstaller), path.join(simulationRoot, targetVersion, targetInstaller))
    await fs.copyFile(path.join(releaseDir, `${targetInstaller}.blockmap`), path.join(simulationRoot, targetVersion, `${targetInstaller}.blockmap`))
    await fs.copyFile(path.join(releaseDir, 'latest.yml'), path.join(simulationRoot, targetVersion, 'latest.yml'))
    await copyIfExists(path.join(simulationRoot, originalVersion, 'latest.yml'), path.join(releaseDir, 'latest.yml'))
    await writeDevUpdateConfig(targetVersion)

    console.log(`Update candidate staged: release/update-sim/${targetVersion}`)
    console.log(`Serve it with: npm run serve:update-feed`)
  } finally {
    await fs.writeFile(packagePath, originalPackage, 'utf8')
  }
}

function run(command, args) {
  const result = childProcess.spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

async function copyIfExists(source, destination) {
  try {
    await fs.copyFile(source, destination)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

async function writeDevUpdateConfig(version) {
  const content = [
    'provider: generic',
    `url: http://127.0.0.1:8787/update-sim/${version}`,
    '',
  ].join('\n')

  await fs.writeFile(path.join(projectRoot, 'dev-app-update.yml'), content, 'utf8')
}

main().catch(async (error) => {
  console.error(error.message)
  process.exit(1)
})
