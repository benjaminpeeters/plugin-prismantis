import { expect, test } from 'claude-code/testing'

import { parseDraft } from '../hooks/draft'
import { recordCopies, recordToasts } from './clipboard-env'

const lines = (text: string) => text.split('\n')

test('a draft parses its header fields and keeps the body exactly as written', () => {
  const draft = parseDraft(lines([
    'kind: email',
    'to: Alice <alice@example.org>',
    'subject: Meeting moved',
    '---',
    '',
    'Hi Alice,',
    '',
    '- the meeting is **Thursday**',
    '',
  ].join('\n')))
  expect(draft).toEqual({ kind: 'email', to: 'Alice <alice@example.org>', subject: 'Meeting moved', body: 'Hi Alice,\n\n- the meeting is **Thursday**', problems: [] })
})

test('every malformed header is a problem, never dropped silently', () => {
  expect(parseDraft(lines('kind: letter\ncc: bob\nnot a field\nsubject: hi\n---\nbody')).problems).toEqual([
    'kind: letter is not one of prompt, email, message, comment',
    'line 2: unknown field cc: (use kind, to, title, subject)',
    'line 3: not a field (use kind, to, title, subject)',
  ])
  expect(parseDraft(lines('kind: message\nsubject: hi\n---\nyo')).problems).toEqual(['subject: is for an email, not a message'])
  expect(parseDraft(lines('to: bob\n---\n')).problems).toEqual(['no kind: line (prompt, email, message, comment)', 'the body is empty'])
  expect(parseDraft(lines('kind: prompt\nno separator')).problems).toEqual(['no --- line between the header and the body'])
})

const prompt = [
  'Before.',
  '',
  '````draft',
  'kind: prompt',
  'to: a session in ~/MEGA/repo/claude',
  'title: Rename the meta repo',
  '---',
  'Rename the repo. Steps:',
  '',
  '1. run this',
  '',
  '```bash',
  'gh repo rename plugin-meta',
  '```',
  '````',
].join('\n')

const mount = (text: string) => ({
  plugin: 'prismantis',
  component: 'AssistantMessage' as const,
  props: { text, isFirstOfReply: true },
  viewport: { columns: 80, rows: 60 },
  surface: 'terminal' as const,
})

test('a prompt draft draws as a titled card, its body as markdown, its copy button copying the body raw', async ($, on) => {
  const copies = recordCopies(on)
  recordToasts(on)
  const ui = await $.ui.mount(mount(prompt))
  expect(await ui.find({ type: 'Text', text: /^Prompt for another session · Rename the meta repo$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^to: a session in ~\/MEGA\/repo\/claude$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^kind: prompt$/ })).toBeUndefined()
  const labels = (await ui.findAll({ type: 'Button' })).map(button => button.props.label)
  expect(labels.filter(label => label === '⧉ source')).toHaveLength(0)
  await ui.press({ key: 'b1.body' })
  expect(copies).toEqual(['Rename the repo. Steps:\n\n1. run this\n\n```bash\ngh repo rename plugin-meta\n```'])
  await ui.unmount()
})

test('an email draft has its own subject copy button', async ($, on) => {
  const copies = recordCopies(on)
  recordToasts(on)
  const ui = await $.ui.mount(mount('```draft\nkind: email\nsubject: Meeting moved\n---\nHi Alice,\n\nThursday.\n```'))
  expect(await ui.find({ type: 'Text', text: /^Email$/ })).toBeTruthy()
  await ui.press({ key: 'b0.subject' })
  await ui.press({ key: 'b0.body' })
  expect(copies).toEqual(['Meeting moved', 'Hi Alice,\n\nThursday.'])
  await ui.unmount()
})

test('a malformed draft still draws, with a red line per problem', async $ => {
  const ui = await $.ui.mount(mount('```draft\nkind: letter\n---\nHello\n```'))
  expect(await ui.find({ type: 'Text', text: /^✗ draft: kind: letter is not one of prompt, email, message, comment$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^Draft$/ })).toBeTruthy()
  await ui.unmount()
})

test('drafts off leaves the block as code', { options: { drafts: false } }, async $ => {
  const ui = await $.ui.mount(mount('```draft\nkind: message\n---\nyo\n```'))
  expect(await ui.find({ type: 'Text', text: /^Message$/ })).toBeUndefined()
  await ui.unmount()
})
