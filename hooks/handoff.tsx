import type { ElementTable, RenderElement } from 'claude-code'

import type { Block } from './markdown'
import type { CopyButton, DrawnBlock } from './render'
import { width } from './render'
import type { Style } from './theme'

// A ```handoff block lists what the person runs themselves: CLAUDE: lines go in the Claude Code
// prompt, CMD: lines in a terminal shell. Each entry's explanation follows as indented # lines,
// `# expect:` naming the outcome; `CMD: |` takes the next lines indented 4 spaces as one command.

export type HandoffKey = 'CLAUDE' | 'CMD'

// notes keep the written order, the `expect:` line among them.
export type HandoffEntry = { key: HandoffKey; command: string; notes: string[] }

export type Handoff = { ok: true; entries: HandoffEntry[] } | { ok: false; problems: string[] }

export type SlashCommand = { command: string; args: string }

export type RunButton = (slash: SlashCommand, line: string, key: string) => RenderElement | null

const ENTRY = /^(CLAUDE|CMD):\s*(.*)$/

const OTHER_KEY = /^([A-Za-z][\w-]*):(\s|$)/

const NOTE = /^ {1,3}#\s?(.*)$/

const CONTINUED = /^ {4}(.*)$/

const SLASH = /^\/([\w:-]+)(?:\s+([\s\S]*))?$/

export const isHandoffLang = (lang: string): boolean => lang.toLowerCase() === 'handoff'

// A card's icons are padded so each click target is three cells wide, not one.
export const cardGlyph = (glyph: string): string => ` ${glyph} `

const slashCommand = (e: HandoffEntry): SlashCommand | undefined => {
  const match = e.key === 'CLAUDE' && !e.command.includes('\n') ? SLASH.exec(e.command) : null
  return match ? { command: match[1]!, args: (match[2] ?? '').trim() } : undefined
}

const isExpect = (note: string): boolean => /^expect:/i.test(note)

const entryProblems = (e: HandoffEntry & { block: boolean }): string[] => {
  const name = e.command.split('\n')[0] || `${e.key}: |`
  const problems: string[] = []
  if (!e.command) problems.push(e.block ? `${e.key}: | has no command lines indented 4 spaces` : `${e.key}: has no command`)
  if (e.key === 'CMD' && SLASH.test(e.command)) problems.push(`CMD: ${name} is a slash command: key it CLAUDE:`)
  if (!e.notes.length) problems.push(`${name} has no # explanation`)
  return problems
}

export const parseHandoff = (lines: readonly string[]): Handoff => {
  const entries: (HandoffEntry & { block: boolean })[] = []
  const problems: string[] = []
  for (const [i, line] of lines.entries()) {
    const last = entries[entries.length - 1]
    const entry = ENTRY.exec(line)
    if (entry) {
      const block = entry[2]!.trim() === '|'
      entries.push({ key: entry[1] as HandoffKey, command: block ? '' : entry[2]!.trim(), notes: [], block })
      continue
    }
    if (line.trim() === '') continue
    const note = NOTE.exec(line)
    const continued = CONTINUED.exec(line)
    if (last?.block && !last.notes.length && continued) {
      last.command = last.command ? `${last.command}\n${continued[1]}` : continued[1]!
      continue
    }
    if (last && note) {
      last.notes.push(note[1]!.trim().replace(/^expect:\s*/i, 'expect: '))
      continue
    }
    const other = OTHER_KEY.exec(line)
    problems.push(other ? `line ${i + 1}: unknown key ${other[1]}: (use CLAUDE: or CMD:)` : `line ${i + 1} is outside any entry: ${line.trim()}`)
  }
  problems.push(...entries.flatMap(entryProblems))
  if (!entries.length && !problems.length) problems.push('no CLAUDE: or CMD: entry')
  return problems.length ? { ok: false, problems } : { ok: true, entries: entries.map(({ block: _, ...e }) => e) }
}

const isHandoff = (block: Block): block is Extract<Block, { kind: 'code' }> =>
  block.kind === 'code' && isHandoffLang(block.lang) && !block.isOpen

export const isHandoffCard = (block: Block): boolean => isHandoff(block)

// Every finished ```handoff block of a reply becomes one, after the last other block, so the
// person finds what to run in one place, at the end, whatever the order Claude wrote it in.
export const handoffLast = (blocks: Block[]): Block[] => {
  const found = blocks.filter(isHandoff)
  if (!found.length || (found.length === 1 && blocks[blocks.length - 1] === found[0])) return blocks
  const lines = found.flatMap((block, i) => (i ? ['', ...block.lines] : block.lines))
  const merged: Block = { kind: 'code', lang: found[0]!.lang, lines, raw: found.map(block => block.raw).join('\n\n') }
  return [...blocks.filter(block => !isHandoff(block)), merged]
}

const BADGE: Record<HandoffKey, string> = { CLAUDE: 'Claude Code', CMD: 'Terminal' }

const BADGE_WIDTH = Math.max(...Object.values(BADGE).map(label => label.length))

// Border and padding on each side, and the gap after the badge.
const FRAME = 4
const GAPS = 2

export const HANDOFF_FORMAT = 'the format is in plugin-display-hint, plugin/note.md'

const handoffRejection = (problems: readonly string[]): string =>
  [...problems.map(problem => `✗ handoff: ${problem}`), `✗ handoff: not drawn as a card; ${HANDOFF_FORMAT}`].join('\n')

const drawHandoff = ({ Box, Text }: ElementTable, style: Style, { entries }: Extract<Handoff, { ok: true }>, copy: CopyButton | undefined, key: string, columns: number, run: RunButton): RenderElement => {
  const t = style.theme
  const ordered = [...entries.filter(e => e.key === 'CLAUDE'), ...entries.filter(e => e.key === 'CMD')]
  const color = (e: HandoffEntry) => (e.key === 'CLAUDE' ? t.link : t.codeCommand)
  const glyphs = (copy ? cardGlyph(style.copyIcon) : '') + (ordered.some(slashCommand) ? cardGlyph(style.runIcon) : '')
  const button = glyphs ? 2 + width(glyphs) : 0
  const longest = Math.max(0, ...ordered.flatMap(e => [...e.command.split('\n'), ...e.notes].map(width)))
  const natural = FRAME + BADGE_WIDTH + GAPS + longest + button
  return (
    <Box key={key} flexDirection="column" alignSelf="flex-start">
      <Box width={Math.min(columns, natural)} borderStyle="round" borderColor={t.codeComment} paddingX={1} flexDirection="column" rowGap={1}>
        {ordered.map((e, i) => {
          const slash = slashCommand(e)
          return (
            <Box key={`${key}.${i}`} flexDirection="row" columnGap={2}>
              <Box width={BADGE_WIDTH} flexShrink={0}><Text bold color={color(e)}>{BADGE[e.key]}</Text></Box>
              <Box width={0} flexGrow={1} flexDirection="column">
                {e.command.split('\n').map((row, r) => <Text key={`c${r}`} color={t.codeText} wrap="wrap">{row}</Text>)}
                {e.notes.map((note, n) => <Text key={`n${n}`} color={isExpect(note) ? t.number : t.codeComment} wrap="wrap">{note}</Text>)}
              </Box>
              <Box flexShrink={0} flexDirection="row">
                {slash ? run(slash, e.command, `${key}.run${i}`) : null}
                {copy ? copy(e.command, `${key}.copy${i}`) : null}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export const drawnHandoff = (el: ElementTable, style: Style, lines: readonly string[], copy: CopyButton | undefined, key: string, columns: number, run: RunButton): DrawnBlock => {
  const handoff = parseHandoff(lines)
  return handoff.ok ? { element: drawHandoff(el, style, handoff, copy, key, columns, run) } : { warning: handoffRejection(handoff.problems) }
}
