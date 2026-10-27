import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULTS } from './manifest.mjs'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests/manifest-defaults.ts')

const lines = Object.entries(DEFAULTS).map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`)
const text = `import type { PluginOptions } from 'claude-code'\n\nexport const DEFAULTS: PluginOptions = {\n${lines.join('\n')}\n}\n`

if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== text) {
    console.error('tests/manifest-defaults.ts does not match plugin.json: run npm --prefix scripts run defaults')
    process.exit(1)
  }
} else {
  writeFileSync(out, text)
}
