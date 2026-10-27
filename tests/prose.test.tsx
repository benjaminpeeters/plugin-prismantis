import { expect, test } from 'claude-code/testing'

import { resolveStyle } from '../hooks/theme'
import type { Found } from './buttons'
import { DEFAULTS } from './manifest-defaults'

const reply = 'A paragraph long enough to read as prose.\n\n- a list item\n- another\n\n```ts\nconst wide = "code keeps the whole width"\n```'

const mount = (surface: 'terminal' | 'desktop', text = reply) => ({ plugin: 'prismantis', component: 'AssistantMessage' as const, props: { text, isFirstOfReply: true }, viewport: { columns: 160, rows: 40 }, surface })

const measured = async (ui: { findAll: (q: { type: 'Box' }) => Promise<Found[]> }) =>
  (await ui.findAll({ type: 'Box' })).filter(box => box.props.width === 80).map(box => box.text ?? '')

for (const surface of ['terminal', 'desktop'] as const) {
  test(`proseCap on ${surface} wraps paragraphs and lists at proseWidth while code keeps the whole width`, { options: { proseCap: true, proseWidth: '80' } }, async $ => {
    const ui = await $.ui.mount(mount(surface))
    const boxes = await measured(ui)
    expect(boxes.some(text => text.includes('A paragraph long enough'))).toBe(true)
    expect(boxes.some(text => text.includes('a list item'))).toBe(true)
    expect(boxes.some(text => text.includes('code keeps the whole width'))).toBe(false)
    await ui.unmount()
  })

  test(`proseCap off on ${surface}, the default, leaves prose at the whole width`, async $ => {
    const ui = await $.ui.mount(mount(surface))
    expect(await measured(ui)).toEqual([])
    await ui.unmount()
  })
}

test('proseCap puts a right-to-left paragraph\'s capped column at the right edge, where it starts', { options: { proseCap: true, proseWidth: '80', rtl: 'warp' } }, async $ => {
  const ui = await $.ui.mount(mount('terminal', 'שלום עולם, זו פסקה בעברית שנקראת מימין לשמאל.\n\nAn English paragraph keeps the left edge.'))
  const boxes = (await ui.findAll({ type: 'Box' })).filter(box => box.props.width === 80)
  expect(boxes.filter(box => !(box.text ?? '').includes('English')).map(box => box.props.alignSelf)).toEqual(['flex-end'])
  expect(boxes.find(box => (box.text ?? '').includes('English'))?.props.alignSelf).toBeUndefined()
  await ui.unmount()
})

test('proseCap leaves a draft card\'s body at the card\'s whole width', { options: { proseCap: true, proseWidth: '80' } }, async $ => {
  const ui = await $.ui.mount(mount('terminal', '```draft\nkind: email\nsubject: Meeting moved\n---\nHi Alice, the meeting moved to Thursday afternoon.\n```'))
  expect((await measured(ui)).some(text => text.includes('Hi Alice'))).toBe(false)
  expect(await ui.find({ type: 'Text', text: /Hi Alice/ })).toBeTruthy()
  await ui.unmount()
})

test('proseCap on with a missing or invalid proseWidth fails loudly, naming the option', () => {
  const { proseWidth: _, ...unset } = DEFAULTS
  expect(() => resolveStyle({ ...unset, proseCap: true })).toThrow(/proseWidth must be a whole number of columns from 40 to 200/)
  for (const proseWidth of ['', 'wide', '30', '80.5']) {
    expect(() => resolveStyle({ ...DEFAULTS, proseCap: true, proseWidth })).toThrow(/proseWidth must be a whole number of columns from 40 to 200/)
  }
  expect(resolveStyle({ ...DEFAULTS, proseCap: true, proseWidth: '80' }).proseWidth).toBe(80)
})
