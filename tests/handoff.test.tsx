import { expect, test } from 'claude-code/testing'

import { HANDOFF_FORMAT, handoffLast, parseHandoff } from '../hooks/handoff'
import { parse } from '../hooks/markdown'
import { labelled } from './buttons'
import { recordCopies, recordToasts } from './clipboard-env'

const hl = { numbers: false, paths: false }

const lines = (text: string) => text.split('\n')

test('a handoff block parses single-line and multi-line entries with their notes and expect line', () => {
  const handoff = parseHandoff(lines([
    'CLAUDE: /add-dir ~/repo/foo',
    '  # makes foo writable for this session',
    '  # Expect:  "Added ~/repo/foo"',
    '  # if it fails, the path is wrong',
    '',
    'CMD: |',
    '    cd ~/x',
    '    # a shell comment stays in the command',
    '    make install',
    '  # builds and installs x',
  ].join('\n')))
  expect(handoff).toEqual({
    ok: true,
    entries: [
      { key: 'CLAUDE', command: '/add-dir ~/repo/foo', notes: ['makes foo writable for this session', 'expect: "Added ~/repo/foo"', 'if it fails, the path is wrong'] },
      { key: 'CMD', command: 'cd ~/x\n# a shell comment stays in the command\nmake install', notes: ['builds and installs x'] },
    ],
  })
})

test('every malformed entry is a problem, never dropped silently', () => {
  const handoff = parseHandoff(lines([
    'CMD: /reload-plugins',
    '  # reloads',
    'SHELL: ls',
    'stray text',
    'CLAUDE: /login',
    'CMD: |',
    '  # nothing to run',
  ].join('\n')))
  expect(handoff).toEqual({
    ok: false,
    problems: [
      'line 3: unknown key SHELL: (use CLAUDE: or CMD:)',
      'line 4 is outside any entry: stray text',
      'CMD: /reload-plugins is a slash command: key it CLAUDE:',
      '/login has no # explanation',
      'CMD: | has no command lines indented 4 spaces',
    ],
  })
  expect(parseHandoff([])).toEqual({ ok: false, problems: ['no CLAUDE: or CMD: entry'] })
})

test('a terminal command that opens with an absolute path is not a slash command', () => {
  expect(parseHandoff(['CMD: /usr/bin/env python3 x.py', '  # runs x']).ok).toBe(true)
  expect(parseHandoff(['CMD: /opt/x/install.sh', '  # installs x']).ok).toBe(true)
  expect(parseHandoff(['CMD: /reload-plugins\tnow', '  # reloads']).ok).toBe(false)
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
  'CMD: ls -la ~/x',
  '  # lists x',
  '```',
].join('\n')

const mount = () => ({
  plugin: 'prismantis',
  component: 'AssistantMessage' as const,
  props: { text: reply, isFirstOfReply: true },
  viewport: { columns: 100, rows: 40 },
  surface: 'terminal' as const,
})

test('a reply draws one hand-off card at its end, Claude Code inputs first, each entry with its own copy icon', { options: { copyIcon: '' } }, async ($, on) => {
  const copies = recordCopies(on)
  recordToasts(on)
  const ui = await $.ui.mount(mount())
  const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text)
  const at = (pattern: RegExp) => texts.findIndex(text => pattern.test(text ?? ''))
  expect(at(/^Claude Code$/)).toBeGreaterThan(at(/^Done with the edit\.$/))
  expect(at(/^Claude Code$/)).toBeLessThan(at(/^Terminal$/))
  expect(at(/^For you to run$/)).toBe(-1)
  expect(at(/expect: gum --version prints a version/)).toBeGreaterThan(-1)
  expect(texts.some(text => /✗ handoff/.test(text ?? ''))).toBe(false)
  const icons = (await ui.findAll({ type: 'Button' })).filter(button => button.props.label === 'copy')
  expect(icons).toHaveLength(3)
  expect(icons.every(button => button.props.plain && button.text === '  ')).toBe(true)
  expect((await ui.findAll({ type: 'Button' })).map(button => button.props.label)).not.toContain('⧉ source')
  await ui.press({ key: 'b1.copy0' })
  await ui.press({ key: 'b1.copy1' })
  expect(copies).toEqual(['/reload-plugins', 'sudo apt install gum'])
  await ui.unmount()
})

test('a slash command entry has a run mark that runs it in the session; a terminal command has none', async ($, on) => {
  const ran: { command: string; args: string }[] = []
  on('command.run', (_$, e) => {
    ran.push({ command: e.command, args: e.args })
    return { text: '' }
  })
  const text = '```handoff\nCLAUDE: /plugin marketplace remove claude-plugin-meta\n  # drops the old record\nCMD: sudo apt install gum\n  # installs gum\n```'
  const ui = await $.ui.mount({ ...mount(), props: { text, isFirstOfReply: true } })
  const marks = (await ui.findAll({ type: 'Button' })).filter(button => String(button.props.label).startsWith('run '))
  expect(marks.map(button => button.props.label)).toEqual(['run /plugin marketplace remove claude-plugin-meta'])
  expect(marks[0]!.text).toBe(' ▷ ')
  await ui.press({ key: 'b0.run0' })
  expect(ran).toEqual([{ command: 'plugin', args: 'marketplace remove claude-plugin-meta' }])
  await ui.unmount()
})

test('runIcon replaces the run mark\'s glyph, padded to three cells like the copy icon', { options: { runIcon: '»' } }, async $ => {
  const text = '```handoff\nCLAUDE: /reload-plugins\n  # reloads the plugins\n```'
  const ui = await $.ui.mount({ ...mount(), props: { text, isFirstOfReply: true } })
  expect((await labelled(ui, 'run /reload-plugins'))?.text).toBe(' » ')
  await ui.unmount()
})

test('a block with any problem is not drawn as a card: it stays code, under a red note pointing to the format', async ($, on) => {
  recordCopies(on)
  const broken = '```handoff\n/plugin marketplace remove claude-plugin-meta\n/reload-plugins\n```'
  const ui = await $.ui.mount({ ...mount(), props: { text: broken, isFirstOfReply: true } })
  expect(await ui.find({ type: 'Text', text: /^Claude Code$/ })).toBeUndefined()
  const note = await ui.find({ type: 'Text', text: /✗ handoff: line 1 is outside any entry: \/plugin marketplace remove claude-plugin-meta/ })
  expect(note?.text).toContain(`✗ handoff: not drawn as a card; ${HANDOFF_FORMAT}`)
  expect(await ui.find({ type: 'Text', text: /\/reload-plugins/ })).toBeTruthy()
  expect((await ui.findAll({ type: 'Button' })).map(button => button.props.label)).toContain('⧉ copy')
  await ui.unmount()
})

test('one bad entry rejects the whole card, valid entries included', async $ => {
  const mixed = '```handoff\nCLAUDE: /reload-plugins\n  # loads the change\nCMD: /add-dir ~/x\n  # miskeyed\n```'
  const ui = await $.ui.mount({ ...mount(), props: { text: mixed, isFirstOfReply: true } })
  expect(await ui.find({ type: 'Text', text: /^Claude Code$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /✗ handoff: CMD: \/add-dir ~\/x is a slash command: key it CLAUDE:/ })).toBeTruthy()
  await ui.unmount()
})

test('in a narrow window the card fits it and its notes wrap in the text column, under themselves', async $ => {
  const long = 'loads the new prismantis code (hand-off cards, heading colors) and display-hint, then redraws every reply'
  const text = ['```handoff', 'CLAUDE: /reload-plugins', `  # ${long}`, '```'].join('\n')
  const ui = await $.ui.mount({ ...mount(), props: { text, isFirstOfReply: true }, viewport: { columns: 60, rows: 40 } })
  const card = (await ui.findAll({ type: 'Box' })).find(box => box.props.borderStyle === 'round')
  expect(card?.props.width).toBeLessThanOrEqual(58)
  const note = await ui.find({ type: 'Text', text: long })
  expect(note?.props.wrap).toBe('wrap')
  await ui.unmount()
})

test('a short card stays as narrow as its content', async $ => {
  const text = ['```handoff', 'CLAUDE: /login', '  # logs in', '```'].join('\n')
  const ui = await $.ui.mount({ ...mount(), props: { text, isFirstOfReply: true }, viewport: { columns: 200, rows: 40 } })
  const card = (await ui.findAll({ type: 'Box' })).find(box => box.props.borderStyle === 'round')
  expect(card?.props.width).toBeLessThan(50)
  await ui.unmount()
})

test('hover copy buttons still leave each hand-off entry its own visible copy button', { options: { copyButtonStyle: 'hover' } }, async $ => {
  const ui = await $.ui.mount(mount())
  expect((await ui.findAll({ type: 'Button' })).filter(button => button.props.label === 'copy')).toHaveLength(3)
  await ui.unmount()
})

test('handoff off leaves hand-off blocks as code where they were written', { options: { handoff: false } }, async $ => {
  const ui = await $.ui.mount(mount())
  expect(await ui.find({ type: 'Text', text: /^Claude Code$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /handoff/ })).toBeTruthy()
  await ui.unmount()
})
