const fs = require('node:fs/promises')
const path = require('node:path')
const pngToIcoModule = require('png-to-ico')
const pngToIco = pngToIcoModule.default || pngToIcoModule

const projectRoot = path.resolve(__dirname, '..')
const sourcePng = path.join(projectRoot, 'public', 'horizon-poro.png')
const outputDir = path.join(projectRoot, 'build')
const outputIco = path.join(outputDir, 'icon.ico')

async function main() {
  await fs.access(sourcePng)
  await fs.mkdir(outputDir, { recursive: true })

  const icon = await pngToIco(sourcePng)
  await fs.writeFile(outputIco, icon)

  console.log(`Windows icon ready: ${path.relative(projectRoot, outputIco)}`)
}

main().catch((error) => {
  console.error(`Failed to generate Windows icon from ${sourcePng}: ${error.message}`)
  process.exit(1)
})
