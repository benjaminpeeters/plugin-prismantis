import { expect, test } from 'claude-code/testing'

import { handoffLast, parseHandoff } from '../hooks/handoff'
import { parse } from '../hooks/markdown'
import { recordCopies, recordToasts } from './clipboard-env'

const hl = { numbers: false, paths: false }

const lines = (text: string) => text.split('\n')

test('a handoff block parses single-line and multi-line entries with their notes and expect line', () => {
  const { entries, problems } = parseHandoff(lines([
    'CLAUDE: /add-dir ~/repo/foo',
    '  # makes foo writable for this session',
    '  # expect: "Added ~/repo/foo"',
    '',
    'CMD: |',
    '    cd ~/x',
    '    # a shell comment stays in the command',
    '    make install',
    '  # builds and installs x',
  ].join('\n')))
  expect(problems).toEqual([])
  expect(entries).toEqual([
    { key: 'CLAUDE', command: '/add-dir ~/repo/foo', notes: ['makes foo writable for this session'], expect: '"Added ~/repo/foo"' },
    { key: 'CMD', command: 'cd ~/x\n# a shell comment stays in the command\nmake install', notes: ['builds and installs x'] },
  ])
})

test('every malformed entry is a problem, never dropped silently', () => {
  const { problems } = parseHandoff(lines([
    'CMD: /reload-plugins',
    '  # reloads',
    'SHELL: ls',
    'stray text',
    'CLAUDE: /login',
    'CMD: |',
    '  # nothing to run',
  ].join('\n')))
  expect(problems).toEqual([
    'line 3: unknown key SHELL: (use CLAUDE: or CMD:)',
    'line 4 is outside any entry: stray text',
    'CMD: /reload-plugins is a slash command: key it CLAUDE:',
    '/login has no # explanation',
    'CMD: | has no command lines indented 4 spaces',
  ])
  expect(parseHandoff([]).problems).toEqual(['no CLAUDE: or CMD: entry'])
})

test('handoff blocks move after the last other block, merged into one', () => {
  const blocks = parse('```handoff\nCMD: ls\n  # lists\n```\n\nText.\n\n```handoff\nCLAUDE: /login\n  # logs in\n```\n\nMore.', hl)
  const moved = handoffLast(blocks)
  expect(moved.map(b => b.kind)).toEqual(['paragraph', 'paragraph', 'code'])
  const last = moved[moved.length - 1]!
  expect(last.kind === 'code' ? last.lines : []).toEqual(['CMD: ls', '  # lists', '', 'CLAUDE: /login', '  # logs in'])
  const alone = parse('Text.\n\n```handoff\nCMD: ls\n  # lists\n```', hl)
  expect(handoffLast(alone)).toBe(alone)
})

const reply = [
  '```handoff',
  'CMD: sudo apt install gum',
  '  # installs gum',
  '  # expect: gum --version prints a version',
  '```',
  '',
  'Done with the edit.',
  '',
  '```handoff',
  'CLAUDE: /reload-plugins',
  '  # loads the change',
  'CMD: /add-dir ~/x',
  '  # miskeyed on purpose',
  '```',
].join('\n')

const mount = () => ({
  plugin: 'prismantis',
  component: 'AssistantMessage' as const,
  props: { text: reply, isFirstOfReply: true },
  viewport: { columns: 100, rows: 40 },
  surface: 'terminal' as const,
})

test('a reply draws one hand-off card at its end, Claude Code inputs first, each entry with its own copy button', async ($, on) => {
  const copies = recordCopies(on)
  recordToasts(on)
  const ui = await $.ui.mount(mount())
  const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text)
  const at = (pattern: RegExp) => texts.findIndex(text => pattern.test(text ?? ''))
  expect(at(/^For you to run$/)).toBeGreaterThan(at(/^Done with the edit\.$/))
  expect(at(/^Claude Code$/)).toBeLessThan(at(/^Terminal$/))
  expect(at(/expect: gum --version prints a version/)).toBeGreaterThan(-1)
  expect(at(/^✗ handoff: CMD: \/add-dir ~\/x is a slash command: key it CLAUDE:$/)).toBeGreaterThan(at(/^For you to run$/))
  const labels = (await ui.findAll({ type: 'Button' })).map(button => button.props.label)
  expect(labels.filter(label => label === '⧉ copy')).toHaveLength(3)
  expect(labels).not.toContain('⧉ source')
  await ui.press({ key: 'b1.copy0' })
  await ui.press({ key: 'b1.copy1' })
  expect(copies).toEqual(['/reload-plugins', 'sudo apt install gum'])
  await ui.unmount()
})

test('hover copy buttons still leave each hand-off entry its own visible copy button', { options: { copyButtonStyle: 'hover' } }, async $ => {
  const ui = await $.ui.mount(mount())
  expect((await ui.findAll({ type: 'Button' })).filter(button => button.props.label === '⧉ copy')).toHaveLength(3)
  await ui.unmount()
})

test('handoff off leaves hand-off blocks as code where they were written', { options: { handoff: false } }, async $ => {
  const ui = await $.ui.mount(mount())
  expect(await ui.find({ type: 'Text', text: /^For you to run$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /handoff/ })).toBeTruthy()
  await ui.unmount()
})
