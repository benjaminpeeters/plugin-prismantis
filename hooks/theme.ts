import type { PluginOptions } from 'claude-code'

import type { ClipboardBackend } from './clipboard'
import type { PresetName } from './presets'
import { PRESET_BACKGROUNDS, PRESET_NAMES, PRESETS } from './presets'
import type { Shape, Terminal } from './rtl'
import { TERMINALS } from './rtl'

export const TOKENS = [
  'accent', 'heading', 'strong', 'emphasis', 'inlineCode', 'codeText', 'codeCommand', 'codeFlag', 'codeString', 'codeComment',
  'link', 'path', 'number', 'quote', 'rule', 'tableHeader', 'tableRule', 'bullet', 'diagram', 'diagramText', 'diffAdded', 'diffRemoved',
  'turnDuration', 'replyBullet', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'diffBackground', 'createdBackground',
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
  answerMark: boolean
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

const trimmed = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export const TOOL_ICON = '●'

// diffTint and diffWordTint: a percent, 0 to 60 and 0 to 90, of the diff color in a changed
// line's background and on top of it under a changed word; anything else keeps the built-in share.
const tintShare = (value: unknown, max: number): number | undefined => {
  const percent = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(percent) && percent >= 0 && percent <= max ? percent / 100 : undefined
}

const columnsFrom = (value: unknown, max: number, rule: string): number => {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 40 || n > max) {
    throw new Error(`prismantis: ${rule}, not ${JSON.stringify(value)}; set it in /config`)
  }
  return n
}

const proseColumns = (value: unknown): number => columnsFrom(value, 200, 'proseCap is on, so proseWidth must be a whole number of columns from 40 to 200')

const toolColumns = (value: unknown): number | null =>
  value === undefined || value === '' ? null : columnsFrom(value, 400, 'toolWidth must be empty or a whole number of columns from 40 to 400')

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
    diffWidth: pick(options.diffWidth, ['fit', 'full'] as const, 'fit'),
    diffFold: pick(options.diffFold, ['none', 'open', 'folded'] as const, 'none'),
    ...(tintShare(options.diffTint, 60) === undefined ? {} : { diffTint: tintShare(options.diffTint, 60) }),
    ...(tintShare(options.diffWordTint, 90) === undefined ? {} : { diffWordTint: tintShare(options.diffWordTint, 90) }),
    diffPath: options.diffPath === true,
    diffBorder: options.diffBorder !== false,
    createdStyle: pick(options.createdStyle, ['preview', 'card'] as const, 'preview'),
    diffToggle: pick(options.diffToggle, ['card', 'row'] as const, 'card'),
    editErrors: pick(options.editErrors, ['shown', 'folded'] as const, 'shown'),
    answerMark: options.answerMark === true,
    stepMark: options.stepMark === true,
    proseWidth: options.proseCap === true ? proseColumns(options.proseWidth) : null,
    toolWidth: toolColumns(options.toolWidth),
    editRow: pick(options.editRow, ['path', 'file'] as const, 'path'),
    pieStyle: pick(options.pieStyle, ['round', 'bars'] as const, 'round'),
    highlightNumbers: options.highlightNumbers !== false,
    highlightPaths: options.highlightPaths !== false,
    mermaid: options.mermaid !== false,
    mermaidAscii: options.mermaidAscii === true,
    copyButtons: options.copyButtons !== false,
    copyButtonStyle: pick(options.copyButtonStyle, ['inline', 'hover', 'icon'] as const, 'inline'),
    replyCopy: pick(options.replyCopy, ['message', 'footer'] as const, 'message'),
    htmlCopy: null,
    httpLinks: false,
    editorLinks: false,
    fileLinks: null,
    pathLinks: false,
    diagramHints: options.diagramHints !== false && options.mermaid !== false,
    issueHint: options.issueHint !== false,
    handoff: options.handoff !== false,
    drafts: options.drafts !== false,
    copyIcon: trimmed(options.copyIcon) || '⧉',
    runIcon: trimmed(options.runIcon) || '▷',
    replyIcon: trimmed(options.replyIcon) || '●',
    thinkingIcon: trimmed(options.thinkingIcon) || '●',
    toolIcon: trimmed(options.toolIcon) || TOOL_ICON,
    turnWord: trimmed(options.turnWord),
    rtl,
    reorder: rtl !== 'auto' && rtl !== 'off',
    shape: rtl === 'auto' || rtl === 'off' ? 'visual' : TERMINALS[rtl],
    latex: options.latex === true,
    cwd: '',
    home: '',
  }
}
