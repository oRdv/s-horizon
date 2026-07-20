import fs from 'node:fs'
import process from 'node:process'

import { chromium } from 'playwright-core'

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173'
const chromeCandidates = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean)
const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate))

if (!executablePath) {
  throw new Error('Chrome/Chromium not found. Set PLAYWRIGHT_CHROME_PATH to run E2E tests.')
}

const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext()
const failures = []

await context.route('**/api/**', (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data: { boosters: [] } }),
}))
await context.route('https://ddragon.leagueoflegends.com/**', (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: route.request().url().endsWith('/api/versions.json') ? JSON.stringify(['15.1.1']) : JSON.stringify({ data: {} }),
}))

try {
  const page = await context.newPage()

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)

    for (const route of ['/', '/privacidade', '/termos-de-uso']) {
      const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

      if (!response?.ok()) failures.push(`${viewport.width}x${viewport.height} ${route}: HTTP ${response?.status()}`)
      if (overflow > 1) failures.push(`${viewport.width}x${viewport.height} ${route}: horizontal overflow ${overflow}px`)
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'domcontentloaded' })

  const home = await page.evaluate(() => ({
    serviceTitles: [...document.querySelectorAll('.service-card h3')].map((element) => element.textContent?.trim()),
    heroTitle: document.querySelector('.hero-title')?.textContent?.replace(/\s+/g, ' ').trim(),
    recruitTitle: document.querySelector('.booster-recruit-card h2')?.textContent?.trim(),
    recruitButton: document.querySelector('.booster-recruit-button')?.textContent?.replace(/\s+/g, ' ').trim(),
    contact: document.querySelector('.public-footer__contact')?.textContent?.trim(),
    legalLinks: [...document.querySelectorAll('.public-footer__links a')].map((element) => element.getAttribute('href')),
  }))

  if (home.serviceTitles.join('|') !== 'Solo|Duo|MD5|Coaching') failures.push('home: service titles differ from requested copy')
  if (home.heroTitle !== 'Descubra o seu verdadeiro potencial com rapidez e qualidade.') failures.push('home: hero title differs from requested copy')
  if (home.recruitTitle !== 'Faça parte da equipe Horizon.') failures.push('home: recruit title differs from requested copy')
  if (home.recruitButton !== 'Quero fazer parte!') failures.push('home: recruit button differs from requested copy')
  if (home.contact !== 'CONTATO: 12 981419074 (WhatsApp)') failures.push('footer: contact differs from requested copy')
  if (home.legalLinks.join('|') !== '/privacidade|/termos-de-uso') failures.push('footer: legal links are missing')
} finally {
  await browser.close()
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Public pages smoke passed against ${baseUrl}`)
