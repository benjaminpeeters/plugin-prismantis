import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../.claude-plugin/plugin.json', import.meta.url)), 'utf8'))

export const DEFAULTS = Object.fromEntries(
  Object.entries(manifest.userConfig).map(([key, field]) => {
    if (!('default' in field)) throw new Error(`plugin.json: userConfig.${key} has no default`)
    return [key, field.default]
  }),
)
