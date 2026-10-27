import { expect, test } from 'claude-code/testing'

import { FORK_OPTIONS, resolveStyle } from '../hooks/theme'
import type { ForkOption } from '../hooks/theme'
import { DEFAULTS } from './manifest-defaults'

const ICONS = ['copyIcon', 'replyIcon', 'thinkingIcon', 'toolIcon', 'askIcon', 'runIcon'] as const satisfies readonly ForkOption[]

test('the manifest defaults resolve, the icons included', () => {
  const style = resolveStyle(DEFAULTS)
  expect(ICONS.map(key => style[key])).toEqual(['⧉', '●', '●', '●', '?', '▷'])
})

test('a fork option left out fails loudly, naming it, as only the manifest holds its default', () => {
  for (const key of FORK_OPTIONS) {
    const { [key]: _, ...unset } = DEFAULTS
    expect(() => resolveStyle(unset)).toThrow(new RegExp(`^prismantis: ${key} must be .*, not undefined`))
  }
})

test('an icon that is not one glyph one cell wide fails loudly, naming the option', () => {
  for (const key of ICONS) {
    for (const value of [' ', 'ab', '🔥']) expect(() => resolveStyle({ ...DEFAULTS, [key]: value })).toThrow(new RegExp(`${key} must be one glyph, one terminal cell wide`))
  }
  expect(resolveStyle({ ...DEFAULTS, toolIcon: '  ' }).toolIcon).toBe('')
})

test('an invalid diff tint fails loudly, naming the option', () => {
  expect(() => resolveStyle({ ...DEFAULTS, diffTint: '61' })).toThrow(/diffTint must be empty or a percent from 0 to 60/)
  expect(() => resolveStyle({ ...DEFAULTS, diffWordTint: 'strong' })).toThrow(/diffWordTint must be empty or a percent from 0 to 90/)
  expect(resolveStyle({ ...DEFAULTS, diffTint: '25' }).diffTint).toBe(0.25)
  expect(resolveStyle(DEFAULTS).diffTint).toBeUndefined()
})

test('a tint or toolWidth takes a number too, and any other type fails with that option\'s own rule', () => {
  expect(resolveStyle({ ...DEFAULTS, diffTint: 25 }).diffTint).toBe(0.25)
  expect(resolveStyle({ ...DEFAULTS, toolWidth: 120 }).toolWidth).toBe(120)
  expect(() => resolveStyle({ ...DEFAULTS, toolWidth: true })).toThrow(/toolWidth must be empty or a whole number of columns from 40 to 400, not true/)
})
