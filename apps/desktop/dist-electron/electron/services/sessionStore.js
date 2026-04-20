import { app } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
export class SessionStore {
    filePath = path.join(app.getPath('userData'), 'horizon-boost-session.json');
    async load() {
        try {
            const rawValue = await readFile(this.filePath, 'utf8');
            return JSON.parse(rawValue);
        }
        catch {
            return null;
        }
    }
    async save(session) {
        if (!session) {
            await this.clear();
            return;
        }
        await mkdir(path.dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(session, null, 2), 'utf8');
    }
    async clear() {
        await rm(this.filePath, { force: true });
    }
}
//# sourceMappingURL=sessionStore.js.map