import fs from 'node:fs'
import process from 'node:process'
import { chromium } from 'playwright-core'

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173'
const chromeCandidates = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean)

const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate))

if (!executablePath) {
  throw new Error('Chrome/Chromium not found. Set PLAYWRIGHT_CHROME_PATH to run E2E tests.')
}

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 1366 },
]

const routes = [
  '/',
  '/privacidade',
  '/termos-de-uso',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/booster/apply',
  '/dashboard',
  '/profile',
  '/orders',
  '/booster/orders',
  '/finance',
  '/admin/users',
  '/payment/success?payment_id=1',
]
const publicRoutes = new Set([
  '/',
  '/privacidade',
  '/termos-de-uso',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/booster/apply',
])

const browser = await chromium.launch({ executablePath, headless: true })
const failures = []

try {
  const context = await browser.newContext()
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const apiPath = url.pathname.replace(/^\/api/, '')

    if (route.request().method() === 'GET' && apiPath === '/landing/boosters') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { boosters: [] } }),
      })
      return
    }

    if (route.request().method() === 'POST' && apiPath === '/auth/login') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'As credenciais informadas são inválidas.' }),
      })
      return
    }

    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated test response.' }),
    })
  })
  await context.route('https://ddragon.leagueoflegends.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname.endsWith('/api/versions.json')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['15.1.1']),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    })
  })
  const page = await context.newPage()
  const consoleErrors = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)

    for (const route of routes) {
      const response = await page.goto(new URL(route, baseUrl).toString(), {
        waitUntil: 'networkidle',
        timeout: 30_000,
      })

      if (!response || !response.ok()) {
        failures.push(`${viewport.width}x${viewport.height} ${route}: HTTP ${response?.status() ?? 'no-response'}`)
      }

      const overflow = await page.evaluate(() => {
        const root = document.documentElement
        const body = document.body

        return Math.max(
          0,
          root.scrollWidth - root.clientWidth,
          body.scrollWidth - body.clientWidth,
        )
      })

      if (overflow > 1) {
        failures.push(`${viewport.width}x${viewport.height} ${route}: horizontal overflow ${overflow}px`)
      }

      const loginRedirectExpected = !publicRoutes.has(route)
      if (loginRedirectExpected && !page.url().includes('/login')) {
        failures.push(`${viewport.width}x${viewport.height} ${route}: protected route did not redirect to login`)
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.goto(new URL('/signup', baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.goBack({ waitUntil: 'networkidle' })

  if (!page.url().includes('/login')) {
    failures.push('browser back from /signup did not return to /login')
  }

  await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Acessar/i }).click()

  const formErrorVisible = await page.locator('.form-error').first().isVisible({ timeout: 10_000 }).catch(() => false)
  if (!formErrorVisible) {
    failures.push('login empty form did not show a visible validation error state')
  }

  if (consoleErrors.length > 0) {
    failures.push(`browser console errors: ${consoleErrors.slice(0, 5).join(' | ')}`)
  }
} finally {
  await browser.close()
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`MVP E2E smoke passed against ${baseUrl}`)
