import { expect, test } from 'claude-code/testing'

import { resolveStyle } from '../hooks/theme'

const reply = 'A paragraph long enough to read as prose.\n\n- a list item\n- another\n\n```ts\nconst wide = "code keeps the whole width"\n```'

const mount = { plugin: 'prismantis', component: 'AssistantMessage' as const, props: { text: reply, isFirstOfReply: true }, viewport: { columns: 160, rows: 40 }, surface: 'terminal' as const }

const measured = async (ui: { findAll: (q: { type: 'Box' }) => Promise<{ props: Record<string, unknown>; text?: string }[]> }) =>
  (await ui.findAll({ type: 'Box' })).filter(box => box.props.width === 80).map(box => box.text ?? '')

test('proseCap wraps paragraphs and lists at proseWidth while code keeps the whole width', { options: { proseCap: true, proseWidth: '80' } }, async $ => {
  const ui = await $.ui.mount(mount)
  const boxes = await measured(ui)
  expect(boxes.some(text => text.includes('A paragraph long enough'))).toBe(true)
  expect(boxes.some(text => text.includes('a list item'))).toBe(true)
  expect(boxes.some(text => text.includes('code keeps the whole width'))).toBe(false)
  await ui.unmount()
})

test('proseCap off, the default, leaves prose at the whole width', async $ => {
  const ui = await $.ui.mount(mount)
  expect(await measured(ui)).toEqual([])
  await ui.unmount()
})

test('proseCap on with a missing or invalid proseWidth fails loudly, naming the option', () => {
  for (const proseWidth of [undefined, '', 'wide', '30', '80.5']) {
    expect(() => resolveStyle({ proseCap: true, ...(proseWidth === undefined ? {} : { proseWidth }) })).toThrow(/proseWidth must be a whole number of columns from 40 to 200/)
  }
  expect(resolveStyle({ proseCap: true, proseWidth: '80' }).proseWidth).toBe(80)
})
