import electronMain from 'electron/main'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { DesktopSession } from '../../shared/types.js'

const { app } = electronMain
export class SessionStore {
  private readonly filePath = path.join(app.getPath('userData'), 'horizon-boost-session.json')

  async load(): Promise<DesktopSession | null> {
    try {
      const rawValue = await readFile(this.filePath, 'utf8')

      return JSON.parse(rawValue) as DesktopSession
    } catch {
      return null
    }
  }

  async save(session: DesktopSession | null): Promise<void> {
    if (!session) {
      await this.clear()
      return
    }

    await mkdir(path.dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(session, null, 2), 'utf8')
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true })
  }
}
