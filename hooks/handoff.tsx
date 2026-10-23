import type { ElementTable, RenderElement } from 'claude-code'

import type { Block } from './markdown'
import type { CopyButton } from './render'
import type { Style } from './theme'

// A ```handoff block lists what the person runs themselves: CLAUDE: lines go in the Claude Code
// prompt, CMD: lines in a terminal shell. Each entry's explanation follows as indented # lines,
// `# expect:` naming the outcome; `CMD: |` takes the next lines indented 4 spaces as one command.

export type HandoffKey = 'CLAUDE' | 'CMD'

export type HandoffEntry = { key: HandoffKey; command: string; notes: string[]; expect?: string }

export type Handoff = { entries: HandoffEntry[]; problems: string[] }

const ENTRY = /^(CLAUDE|CMD):\s*(.*)$/

const OTHER_KEY = /^([A-Za-z][\w-]*):(\s|$)/

const NOTE = /^ {1,3}#\s?(.*)$/

const CONTINUED = /^ {4}(.*)$/

export const isHandoffLang = (lang: string): boolean => lang.toLowerCase() === 'handoff'

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
    if (last?.block && !last.notes.length && last.expect === undefined && continued) {
      last.command = last.command ? `${last.command}\n${continued[1]}` : continued[1]!
      continue
    }
    if (last && note) {
      const text = note[1]!.trim()
      if (/^expect:/i.test(text)) last.expect = text.replace(/^expect:\s*/i, '')
      else last.notes.push(text)
      continue
    }
    const other = OTHER_KEY.exec(line)
    problems.push(other ? `line ${i + 1}: unknown key ${other[1]}: (use CLAUDE: or CMD:)` : `line ${i + 1} is outside any entry: ${line.trim()}`)
  }
  for (const e of entries) {
    const name = e.command.split('\n')[0] || `${e.key}: |`
    if (!e.command) problems.push(e.block ? `${e.key}: | has no command lines indented 4 spaces` : `${e.key}: has no command`)
    if (e.key === 'CMD' && e.command.startsWith('/')) problems.push(`CMD: ${name} is a slash command: key it CLAUDE:`)
    if (!e.notes.length && e.expect === undefined) problems.push(`${name} has no # explanation`)
  }
  if (!entries.length && !problems.length) problems.push('no CLAUDE: or CMD: entry')
  return { entries: entries.map(({ block: _, ...e }) => e), problems }
}

const isHandoff = (block: Block): block is Extract<Block, { kind: 'code' }> =>
  block.kind === 'code' && isHandoffLang(block.lang) && !block.isOpen

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

export const drawHandoff = ({ Box, Text }: ElementTable, style: Style, lines: readonly string[], copy: CopyButton | undefined, key: string): RenderElement => {
  const t = style.theme
  const { entries, problems } = parseHandoff(lines)
  const ordered = [...entries.filter(e => e.key === 'CLAUDE'), ...entries.filter(e => e.key === 'CMD')]
  const color = (e: HandoffEntry) => (e.key === 'CLAUDE' ? t.link : t.codeCommand)
  return (
    <Box key={key} flexDirection="column" alignSelf="flex-start">
      <Box borderStyle="round" borderColor={t.codeComment} paddingX={1} flexDirection="column" rowGap={1}>
        <Text bold color={t.strong}>For you to run</Text>
        {ordered.map((e, i) => (
          <Box key={`${key}.${i}`} flexDirection="column">
            <Box flexDirection="row" columnGap={2}>
              <Box width={BADGE_WIDTH} flexShrink={0}><Text bold color={color(e)}>{BADGE[e.key]}</Text></Box>
              <Box flexDirection="column" flexGrow={1}>
                {e.command.split('\n').map((row, r) => <Text key={r} color={t.codeText}>{row}</Text>)}
              </Box>
              {copy?.(e.command, `${key}.copy${i}`) ?? null}
            </Box>
            {e.notes.map((note, n) => <Text key={`n${n}`} color={t.codeComment}>{' '.repeat(BADGE_WIDTH + 2)}{note}</Text>)}
            {e.expect === undefined ? null : <Text color={t.number}>{' '.repeat(BADGE_WIDTH + 2)}expect: {e.expect}</Text>}
          </Box>
        ))}
      </Box>
      {problems.map((problem, p) => <Text key={`${key}.p${p}`} color={t.codeFlag}>✗ handoff: {problem}</Text>)}
    </Box>
  )
}
