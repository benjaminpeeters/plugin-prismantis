import type { ElementTable, RenderElement } from 'claude-code'

import type { CopyButton } from './render'
import type { Style, Theme } from './theme'

// A ```draft block is text the person sends on themselves: a prompt for another session, an
// email, a chat message or a GitHub comment. `key: value` header lines, then a line `---`, then
// the body as it is to be pasted. A body holding ``` fences opens the draft with ````.

export const DRAFT_KINDS = ['prompt', 'email', 'message', 'comment'] as const

export type DraftKind = (typeof DRAFT_KINDS)[number]

export type Draft = { kind?: DraftKind; to?: string; title?: string; subject?: string; body: string; problems: string[] }

const FIELDS = ['kind', 'to', 'title', 'subject'] as const

const HEADER = /^([A-Za-z][\w-]*):\s*(.*)$/

const LABEL: Record<DraftKind, string> = { prompt: 'Prompt for another session', email: 'Email', message: 'Message', comment: 'GitHub comment' }

const color = (t: Theme, kind: DraftKind | undefined): string | undefined =>
  kind === 'prompt' ? t.link : kind === 'email' ? t.codeString : kind === 'message' ? t.emphasis : kind === 'comment' ? t.codeCommand : t.codeFlag

export const isDraftLang = (lang: string): boolean => lang.toLowerCase() === 'draft'

export const parseDraft = (lines: readonly string[]): Draft => {
  const split = lines.findIndex(line => line.trim() === '---')
  const head = split < 0 ? [] : lines.slice(0, split)
  const draft: Draft = { body: (split < 0 ? lines : lines.slice(split + 1)).join('\n').replace(/^\n+|\n+$/g, ''), problems: [] }
  if (split < 0) draft.problems.push('no --- line between the header and the body')
  for (const [i, line] of head.entries()) {
    if (line.trim() === '') continue
    const field = HEADER.exec(line)
    const name = field?.[1]!.toLowerCase()
    if (!field || !(FIELDS as readonly string[]).includes(name!)) {
      draft.problems.push(`line ${i + 1}: ${field ? `unknown field ${field[1]}:` : 'not a field'} (use ${FIELDS.join(', ')})`)
      continue
    }
    const value = field[2]!.trim()
    if (name === 'kind') {
      if ((DRAFT_KINDS as readonly string[]).includes(value)) draft.kind = value as DraftKind
      else draft.problems.push(`kind: ${value || '(empty)'} is not one of ${DRAFT_KINDS.join(', ')}`)
    } else draft[name as 'to' | 'title' | 'subject'] = value
  }
  if (split >= 0 && draft.kind === undefined && !draft.problems.some(p => p.startsWith('kind:'))) draft.problems.push(`no kind: line (${DRAFT_KINDS.join(', ')})`)
  if (draft.subject !== undefined && draft.kind !== undefined && draft.kind !== 'email') draft.problems.push(`subject: is for an email, not a ${draft.kind}`)
  if (!draft.body.trim()) draft.problems.push('the body is empty')
  return draft
}

// The card spans the window: the body is drawn as markdown by `body`, at the card's inner width,
// while the copy icons (`copy`), top right and after an email's subject, hand over the text
// exactly as written.
export const drawDraft = (el: ElementTable, style: Style, lines: readonly string[], copy: CopyButton | undefined, key: string, columns: number, body: (text: string, columns: number) => RenderElement[]): RenderElement => {
  const { Box, Text } = el
  const t = style.theme
  const draft = parseDraft(lines)
  const tint = color(t, draft.kind)
  const head = [draft.kind ? LABEL[draft.kind] : 'Draft', draft.title].filter(Boolean).join(' · ')
  return (
    <Box key={key} flexDirection="column" width={columns}>
      <Box borderStyle="round" borderColor={tint} paddingX={1} flexDirection="column" rowGap={1}>
        <Box flexDirection="row" columnGap={2}>
          <Box width={0} flexGrow={1} flexDirection="column">
            <Text bold color={tint} wrap="wrap">{head}</Text>
            {draft.to ? <Text color={t.codeComment} wrap="wrap">to: {draft.to}</Text> : null}
            {draft.subject !== undefined ? (
              <Box flexDirection="row" columnGap={1}>
                <Text wrap="wrap"><Text color={t.codeComment}>subject: </Text>{draft.subject}</Text>
                {copy?.(draft.subject, `${key}.subject`, 'copy subject') ?? null}
              </Box>
            ) : null}
          </Box>
          <Box flexShrink={0}>{copy?.(draft.body, `${key}.body`) ?? null}</Box>
        </Box>
        <Box flexDirection="column" rowGap={1}>{body(draft.body, columns - 4)}</Box>
      </Box>
      {draft.problems.map((problem, p) => <Text key={`${key}.p${p}`} color={t.codeFlag} wrap="wrap">✗ draft: {problem}</Text>)}
    </Box>
  )
}
