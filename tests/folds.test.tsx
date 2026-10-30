import { expect, test } from 'claude-code/testing'

import { resolveStyle } from '../hooks/theme'
import { labelled } from './buttons'
import { DEFAULTS } from './manifest-defaults'

const numbered = (count: number, word: string) => Array.from({ length: count }, (_, i) => `${word} ${i + 1}`)

test('promptFold and replyFold take a whole number of lines from 1 to 1000 or empty, and fail loudly on anything else', () => {
  expect(resolveStyle(DEFAULTS).promptFold).toBe(20)
  expect(resolveStyle(DEFAULTS).replyFold).toEqual({ lines: 60, tail: 20 })
  expect(resolveStyle({ ...DEFAULTS, promptFold: '', replyFold: 5 }).promptFold).toBeNull()
  expect(resolveStyle({ ...DEFAULTS, replyFold: 5, replyFoldTail: '0' }).replyFold).toEqual({ lines: 5, tail: 0 })
  expect(resolveStyle({ ...DEFAULTS, replyFold: '' }).replyFold).toBeNull()
  for (const value of ['', '-1', '1001', 'few']) expect(() => resolveStyle({ ...DEFAULTS, replyFoldTail: value })).toThrow(/replyFoldTail must be a whole number of lines from 0 to 1000/)
  for (const value of ['0', '1001', '2.5', 'many', true]) {
    expect(() => resolveStyle({ ...DEFAULTS, promptFold: value })).toThrow(/promptFold must be empty or a whole number of lines from 1 to 1000/)
    expect(() => resolveStyle({ ...DEFAULTS, replyFold: value })).toThrow(/replyFold must be empty or a whole number of lines from 1 to 1000/)
  }
})

for (const surface of ['terminal', 'desktop'] as const) {
  const view = { plugin: 'prismantis', viewport: { columns: 100, rows: 40 }, surface }
  const prompt = (text: string, isExpanded = false) => ({ ...view, component: 'UserMessage' as const, props: { text, origin: { kind: 'composer' } as never, isExpanded } })
  const reply = (text: string) => ({ ...view, component: 'AssistantMessage' as const, props: { text, isFirstOfReply: true } })
  const line = (word: string, n: number) => ({ type: 'Text', text: new RegExp(`^${word} ${n}$`) }) as const

  test(`a prompt past promptFold lines shows its first lines and a button that opens the rest on ${surface}`, async $ => {
    const ui = await $.ui.mount(prompt(numbered(25, 'line').join('\n')))
    expect(await ui.find(line('line', 20))).toBeTruthy()
    expect(await ui.find(line('line', 21))).toBeUndefined()
    expect(await labelled(ui, '+5 more lines')).toBeTruthy()
    await ui.press({ key: 'promptfold' })
    expect(await ui.find(line('line', 25))).toBeTruthy()
    expect(await labelled(ui, 'show less')).toBeTruthy()
    await ui.unmount()
  })

  test(`a prompt within promptFold lines, or drawn expanded (ctrl+o), shows whole with no button on ${surface}`, async $ => {
    for (const shown of [prompt(numbered(20, 'line').join('\n')), prompt(numbered(25, 'line').join('\n'), true)]) {
      const ui = await $.ui.mount(shown)
      expect(await ui.find(line('line', 20))).toBeTruthy()
      expect(await ui.findAll({ type: 'Button' })).toEqual([])
      await ui.unmount()
    }
  })

  test(`a prompt line wider than the window counts the rows it wraps to, and keeps the rows within the limit, on ${surface}`, { options: { promptFold: '5' } }, async $ => {
    const ui = await $.ui.mount(prompt(`start ${'word '.repeat(200)}\nsecond line`))
    const first = await ui.find({ type: 'Text', text: /^start word/ })
    expect(first?.text?.split('\n')).toHaveLength(5)
    expect(first?.text?.split('\n').every(row => row.length <= 92)).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^second line$/ })).toBeUndefined()
    expect(await labelled(ui, '+8 more lines')).toBeTruthy()
    await ui.unmount()
  })

  test(`a paste drawn as a closed frame counts as the three lines the frame takes, however long the paste, on ${surface}`, { options: { promptFold: '5' } }, async $ => {
    const pasted = `<pasted_content id="a">\n${numbered(200, 'pasted').join('\n')}\n</pasted_content id="a">`
    const ui = await $.ui.mount(prompt(['look at this:', pasted, 'line 1', 'line 2', 'line 3'].join('\n')))
    expect(await labelled(ui, 'pasted text · 200 lines')).toBeTruthy()
    expect(await ui.find(line('line', 1))).toBeTruthy()
    expect(await ui.find(line('line', 2))).toBeUndefined()
    expect(await labelled(ui, '+2 more lines')).toBeTruthy()
    await ui.unmount()
  })

  test(`with promptStyle off, Claude Code's own row draws a folded prompt's first lines, a paste as its plain lines, with a show more button that gives it the whole prompt, on ${surface}`, { options: { promptStyle: 'off', promptFold: '5' } }, async ($, on) => {
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>{e.component === 'UserMessage' ? `engine: ${String(e.props.text)}` : 'engine'}</Text>
    })
    const short = await $.ui.mount(prompt('hi'))
    expect(await short.find({ type: 'Text', text: /^engine: hi$/ })).toBeTruthy()
    await short.unmount()
    const pasted = `<pasted_content id="a">\n${numbered(3, 'pasted').join('\n')}\n</pasted_content id="a">`
    const typed = ['', '', `start ${'word '.repeat(60)}`, pasted, ...numbered(20, 'line')].join('\n')
    const ui = await $.ui.mount(prompt(typed))
    expect((await ui.find({ type: 'Text', text: /^engine: / }))?.text).toBe(`engine: start ${'word '.repeat(60)}\npasted 1`)
    expect(await labelled(ui, 'show more')).toBeTruthy()
    await ui.press({ key: 'promptfold' })
    expect((await ui.find({ type: 'Text', text: /^engine: / }))?.text).toBe(`engine: ${typed}`)
    expect(await labelled(ui, 'show less')).toBeTruthy()
    await ui.unmount()
  })

  test(`a reply counts the screen lines its long paragraphs wrap to on ${surface}`, { options: { replyFold: '10', replyFoldTail: '0' } }, async $ => {
    const ui = await $.ui.mount(reply(numbered(5, 'Para').map(head => `${head} ${'word '.repeat(60).trim()}`).join('\n\n')))
    expect(await ui.find({ type: 'Text', text: /^Para 2 / })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^Para 3 / })).toBeUndefined()
    expect(await labelled(ui, '+14 more lines')).toBeTruthy()
    await ui.unmount()
  })

  test(`promptFold empty never folds a prompt on ${surface}`, { options: { promptFold: '' } }, async $ => {
    const ui = await $.ui.mount(prompt(numbered(40, 'line').join('\n')))
    expect(await ui.find(line('line', 40))).toBeTruthy()
    await ui.unmount()
  })

  test(`a reply past replyFold lines shows the blocks that start within the limit and those in its last replyFoldTail lines, the button between opening the middle, on ${surface}`, async $ => {
    const ui = await $.ui.mount(reply(numbered(60, 'Point').join('\n\n')))
    for (const n of [30, 51, 60]) expect(await ui.find(line('Point', n))).toBeTruthy()
    for (const n of [31, 50]) expect(await ui.find(line('Point', n))).toBeUndefined()
    expect(await labelled(ui, '+39 more lines')).toBeTruthy()
    await ui.press({ key: 'replyfold' })
    expect(await ui.find(line('Point', 40))).toBeTruthy()
    expect(await labelled(ui, 'show less')).toBeTruthy()
    await ui.unmount()
  })

  test(`a reply whose first replyFold and last replyFoldTail lines cover it all is not folded on ${surface}`, async $ => {
    const ui = await $.ui.mount(reply(numbered(40, 'Point').join('\n\n')))
    expect(await ui.find(line('Point', 35))).toBeTruthy()
    expect(await ui.findAll({ type: 'Button' }).then(buttons => buttons.filter(b => /more lines/.test(String(b.props.label))))).toEqual([])
    await ui.unmount()
  })

  test(`a block starting within replyFold shows whole, a long code block keeping its own fold, on ${surface}`, { options: { replyFold: '10', replyFoldTail: '0' } }, async $ => {
    const ui = await $.ui.mount(reply(['Run it:', '', '```python', ...numbered(31, 'step'), '```', '', 'After.', '', 'Done.'].join('\n')))
    expect(await labelled(ui, '+11 more lines')).toBeTruthy()
    expect(await labelled(ui, '+3 more lines')).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^After\.$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`an indented prompt line cut by the fold loses its indent, as the shared wrapper drops it, on ${surface}`, { options: { promptFold: '2' } }, async $ => {
    const ui = await $.ui.mount(prompt(`    indented ${'word '.repeat(100)}`))
    const cut = await ui.find({ type: 'Text', text: /^indented word/ })
    expect(cut?.text?.split('\n')).toHaveLength(2)
    await ui.unmount()
  })

  test(`a long code block counts the lines it draws while its own fold is closed, not its whole source, on ${surface}`, async $ => {
    const ui = await $.ui.mount(reply(['Intro.', '', '```ts', ...numbered(300, 'step'), '```', '', numbered(15, 'Point').join('\n\n')].join('\n')))
    expect(await ui.find(line('Point', 15))).toBeTruthy()
    expect(await labelled(ui, '+280 more lines')).toBeTruthy()
    expect((await ui.findAll({ type: 'Button' })).filter(button => /^\+\d+ more lines$/.test(String(button.props.label)))).toHaveLength(1)
    await ui.unmount()
  })

  test(`a hand-off card at the end of a folded reply stays drawn on ${surface}`, { options: { replyFold: '10', replyFoldTail: '0' } }, async $ => {
    const ui = await $.ui.mount(reply([...numbered(10, 'Point').join('\n\n').split('\n'), '', '```handoff', 'CLAUDE: /reload-plugins', '  # loads the fix', '```'].join('\n')))
    expect(await ui.find(line('Point', 6))).toBeUndefined()
    const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text ?? '')
    expect(texts.some(text => text.includes('/reload-plugins'))).toBe(true)
    expect(await labelled(ui, '+9 more lines')).toBeTruthy()
    await ui.unmount()
  })

  test(`replyFold empty never folds a reply on ${surface}`, { options: { replyFold: '' } }, async $ => {
    const ui = await $.ui.mount(reply(numbered(60, 'Point').join('\n\n')))
    expect(await ui.find(line('Point', 40))).toBeTruthy()
    expect(await labelled(ui, '+39 more lines')).toBeUndefined()
    await ui.unmount()
  })
}
