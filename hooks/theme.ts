import type { PluginOptions } from 'claude-code'

import type { ClipboardBackend } from './clipboard'
import type { PresetName } from './presets'
import { PRESET_BACKGROUNDS, PRESET_NAMES, PRESETS } from './presets'
import { width } from './render'
import type { Shape, Terminal } from './rtl'
import { TERMINALS } from './rtl'

export const TOKENS = [
  'accent', 'heading', 'strong', 'emphasis', 'inlineCode', 'codeText', 'codeCommand', 'codeFlag', 'codeString', 'codeComment',
  'link', 'path', 'number', 'quote', 'rule', 'tableHeader', 'tableRule', 'bullet', 'diagram', 'diagramText', 'diffAdded', 'diffRemoved',
  'turnDuration', 'replyBullet', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'diffBackground', 'createdBackground', 'ask',
] as const

export type Theme = Partial<Record<(typeof TOKENS)[number], string>>

export type Clock = 'off' | '24h' | '12h'

export type Style = {
  theme: Theme
  background?: string
  headingStyle: 'bold' | 'underline' | 'uppercase' | 'banner'
  tableStyle: 'box' | 'rules' | 'grid' | 'minimal'
  taskStyle: 'checks' | 'ticks' | 'box' | 'progress'
  promptStyle: 'bubble' | 'wide' | 'bar' | 'chevron' | 'off'
  clock: Clock
  toolStyle: 'chat' | 'tree-dim' | 'tree-bold' | 'classic'
  toolOutput: 'full' | 'quiet'
  narration?: boolean
  inside?: 'quote' | 'alert'
  noteKey?: string
  pressPreview?: boolean
  diffStyle: 'card' | 'full' | 'marks' | 'bar'
  diffWidth: 'fit' | 'full'
  diffFold: 'none' | 'open' | 'folded'
  diffTint?: number
  diffWordTint?: number
  diffPath: boolean
  createdStyle: 'preview' | 'card'
  diffToggle: 'card' | 'row'
  editErrors: 'shown' | 'folded'
  stepMark: boolean
  dimProse?: true
  proseWidth: number | null
  toolWidth: number | null
  editRow: 'path' | 'file'
  diffBorder: boolean
  pieStyle: 'round' | 'bars'
  highlightNumbers: boolean
  highlightPaths: boolean
  mermaid: boolean
  mermaidAscii: boolean
  copyButtons: boolean
  copyButtonStyle: 'inline' | 'hover' | 'icon'
  replyCopy: 'message' | 'footer'
  htmlCopy: ClipboardBackend | null
  nativeCode?: boolean
  gridFace?: boolean
  httpLinks: boolean
  editorLinks: boolean
  fileLinks: string | null
  pathLinks: boolean
  found?: ReadonlySet<string>
  diagramHints: boolean
  issueHint: boolean
  handoff: boolean
  drafts: boolean
  copyIcon: string
  runIcon: string
  replyIcon: string
  thinkingIcon: string
  toolIcon: string
  askIcon: string
  askAlign: 'left' | 'right'
  toolResults: 'folded' | 'shown'
  renderLog: boolean
  turnWord: string
  rtl: 'auto' | Terminal | 'off'
  reorder: boolean
  shape: Shape
  latex: boolean
  cwd: string
  home: string
}

const COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|ansi256\(\d{1,3}\)|(black|red|green|yellow|blue|magenta|cyan|white|gray|grey)(Bright)?)$/i

export const isColor = (value: unknown): value is string => typeof value === 'string' && COLOR.test(value.trim())

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export const RANDOM_THEMES: readonly string[] = PRESET_NAMES.filter(t => !/latte|light|dawn/.test(t) && t !== 'mono')

export const FORK_OPTIONS = [
  'diffWidth', 'diffFold', 'diffTint', 'diffWordTint', 'proseCap', 'toolWidth', 'diffToggle', 'stepMark', 'editErrors', 'editRow', 'createdStyle',
  'diffBorder', 'diffPath', 'handoff', 'drafts', 'copyIcon', 'replyIcon', 'thinkingIcon', 'toolIcon', 'askIcon', 'askAlign', 'runIcon', 'toolResults', 'renderLog', 'turnWord', 'replyCopy',
] as const

export type ForkOption = (typeof FORK_OPTIONS)[number]

const fail = (rule: string, value: unknown): never => {
  throw new Error(`prismantis: ${rule}, not ${JSON.stringify(value)}; set it in /config`)
}

const flag = (options: PluginOptions, key: ForkOption): boolean => {
  const value = options[key]
  return typeof value === 'boolean' ? value : fail(`${key} must be true or false`, value)
}

const choice = <T extends string>(options: PluginOptions, key: ForkOption, allowed: readonly T[]): T => {
  const value = options[key]
  return allowed.includes(value as T) ? (value as T) : fail(`${key} must be one of ${allowed.join(', ')}`, value)
}

const text = (options: PluginOptions, key: ForkOption): string => {
  const value = options[key]
  return typeof value === 'string' ? value.trim() : fail(`${key} must be a text`, value)
}

const glyph = (options: PluginOptions, key: ForkOption): string => {
  const value = text(options, key)
  return width(value) === 1 ? value : fail(`${key} must be one glyph, one terminal cell wide`, options[key])
}

const numeric = (options: PluginOptions, key: ForkOption, rule: string): string => {
  const value = options[key]
  return typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : fail(rule, value)
}

const tintShare = (options: PluginOptions, key: ForkOption, max: number): number | undefined => {
  const rule = `${key} must be empty or a percent from 0 to ${max}`
  const value = numeric(options, key, rule)
  if (value === '') return undefined
  const percent = Number(value)
  return Number.isFinite(percent) && percent >= 0 && percent <= max ? percent / 100 : fail(rule, options[key])
}

const columnsFrom = (value: unknown, max: number, rule: string): number => {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= 40 && n <= max ? n : fail(rule, value)
}

const proseColumns = (value: unknown): number => columnsFrom(value, 200, 'proseCap is on, so proseWidth must be a whole number of columns from 40 to 200')

const toolColumns = (options: PluginOptions): number | null => {
  const rule = 'toolWidth must be empty or a whole number of columns from 40 to 400'
  return numeric(options, 'toolWidth', rule) === '' ? null : columnsFrom(options.toolWidth, 400, rule)
}

export const pickTheme = (value: unknown, random = Math.random): string => {
  const name = value === 'random' ? RANDOM_THEMES[Math.floor(random() * RANDOM_THEMES.length)] : value
  return (PRESET_NAMES as readonly unknown[]).includes(name) ? String(name) : 'catppuccin-mocha'
}

export const resolveStyle = (options: PluginOptions): Style => {
  const preset = (PRESET_NAMES as string[]).includes(String(options.theme)) ? (String(options.theme) as PresetName) : 'catppuccin-mocha'
  const base: Theme = PRESETS[preset]
  const fromFields = Object.fromEntries(
    TOKENS.filter(k => isColor(options[`${k}Color`])).map(k => [k, String(options[`${k}Color`]).trim()]),
  )

  const rtl = pick(options.rtl, ['auto', 'off', ...(Object.keys(TERMINALS) as Terminal[])], 'auto')
  const diffTint = tintShare(options, 'diffTint', 60)
  const diffWordTint = tintShare(options, 'diffWordTint', 90)

  return {
    theme: { ...base, ...fromFields },
    ...(PRESET_BACKGROUNDS[preset] ? { background: PRESET_BACKGROUNDS[preset] } : {}),
    headingStyle: pick(options.headingStyle, ['bold', 'underline', 'uppercase', 'banner'] as const, 'banner'),
    tableStyle: pick(options.tableStyle, ['box', 'rules', 'grid', 'minimal'] as const, 'box'),
    taskStyle: pick(options.taskStyle, ['checks', 'ticks', 'box', 'progress'] as const, 'checks'),
    promptStyle: pick(options.promptStyle, ['bubble', 'wide', 'bar', 'chevron', 'off'] as const, 'bubble'),
    clock: pick(options.clock, ['off', '24h', '12h'] as const, 'off'),
    toolStyle: pick(options.toolStyle, ['chat', 'tree-dim', 'tree-bold', 'classic'] as const, 'chat'),
    toolOutput: pick(options.toolOutput, ['full', 'quiet'] as const, 'full'),
    diffStyle: pick(options.diffStyle, ['card', 'full', 'marks', 'bar'] as const, 'card'),
    diffWidth: choice(options, 'diffWidth', ['fit', 'full'] as const),
    diffFold: choice(options, 'diffFold', ['none', 'open', 'folded'] as const),
    ...(diffTint === undefined ? {} : { diffTint }),
    ...(diffWordTint === undefined ? {} : { diffWordTint }),
    diffPath: flag(options, 'diffPath'),
    diffBorder: flag(options, 'diffBorder'),
    createdStyle: choice(options, 'createdStyle', ['preview', 'card'] as const),
    diffToggle: choice(options, 'diffToggle', ['card', 'row'] as const),
    editErrors: choice(options, 'editErrors', ['shown', 'folded'] as const),
    stepMark: flag(options, 'stepMark'),
    proseWidth: flag(options, 'proseCap') ? proseColumns(options.proseWidth) : null,
    toolWidth: toolColumns(options),
    editRow: choice(options, 'editRow', ['path', 'file'] as const),
    pieStyle: pick(options.pieStyle, ['round', 'bars'] as const, 'round'),
    highlightNumbers: options.highlightNumbers !== false,
    highlightPaths: options.highlightPaths !== false,
    mermaid: options.mermaid !== false,
    mermaidAscii: options.mermaidAscii === true,
    copyButtons: options.copyButtons !== false,
    copyButtonStyle: pick(options.copyButtonStyle, ['inline', 'hover', 'icon'] as const, 'inline'),
    replyCopy: choice(options, 'replyCopy', ['message', 'footer'] as const),
    htmlCopy: null,
    httpLinks: false,
    editorLinks: false,
    fileLinks: null,
    pathLinks: false,
    diagramHints: options.diagramHints !== false && options.mermaid !== false,
    issueHint: options.issueHint !== false,
    handoff: flag(options, 'handoff'),
    drafts: flag(options, 'drafts'),
    copyIcon: glyph(options, 'copyIcon'),
    runIcon: glyph(options, 'runIcon'),
    replyIcon: glyph(options, 'replyIcon'),
    thinkingIcon: glyph(options, 'thinkingIcon'),
    toolIcon: glyph(options, 'toolIcon'),
    askIcon: glyph(options, 'askIcon'),
    askAlign: choice(options, 'askAlign', ['left', 'right'] as const),
    toolResults: choice(options, 'toolResults', ['folded', 'shown'] as const),
    renderLog: flag(options, 'renderLog'),
    turnWord: text(options, 'turnWord'),
    rtl,
    reorder: rtl !== 'auto' && rtl !== 'off',
    shape: rtl === 'auto' || rtl === 'off' ? 'visual' : TERMINALS[rtl],
    latex: options.latex === true,
    cwd: '',
    home: '',
  }
}
