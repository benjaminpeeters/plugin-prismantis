// Candidate looks for diff cards, drawn one under the other by `/prismantis diffs` so a look is
// picked by eye. Each names the options that reproduce it; unset fields keep the theme's own value.

export type DiffPalette = { name: string; diffBackground?: string; diffAdded?: string; diffRemoved?: string; tint?: number; word?: number; border?: boolean }

// Muted grey, the palette picked from the first round, with a quieter line tint and the changed
// words set apart from it; with and without the border.
const MUTED = { diffBackground: '#1c1c1c', diffAdded: '#87af87', diffRemoved: '#d78787' }

export const DIFF_PALETTES: readonly DiffPalette[] = [
  { name: 'Lines 6%, words 30%', ...MUTED, tint: 6, word: 30, border: true },
  { name: 'Lines 4%, words 40%', ...MUTED, tint: 4, word: 40, border: true },
  { name: 'Lines 3%, words 50%', ...MUTED, tint: 3, word: 50, border: true },
  { name: 'Lines 0% (only words), words 35%', ...MUTED, tint: 0, word: 35, border: true },
  { name: 'Lines 0% (only words), words 50%', ...MUTED, tint: 0, word: 50, border: true },
  { name: 'Lines 6%, words 30%, no border', ...MUTED, tint: 6, word: 30, border: false },
  { name: 'Lines 4%, words 40%, no border', ...MUTED, tint: 4, word: 40, border: false },
  { name: 'Lines 3%, words 50%, no border', ...MUTED, tint: 3, word: 50, border: false },
  { name: 'Lines 0% (only words), words 40%, no border', ...MUTED, tint: 0, word: 40, border: false },
  { name: 'Lines 4%, words 40%, border, no background', diffAdded: MUTED.diffAdded, diffRemoved: MUTED.diffRemoved, tint: 4, word: 40, border: true },
]

export const DIFFS_TEXT = 'Diff card looks: each sample below is the same edit, drawn with the options under its name.'

export const paletteOptions = (p: DiffPalette): string =>
  [
    `"diffBackgroundColor": "${p.diffBackground ?? ''}"`,
    p.diffAdded ? `"diffAddedColor": "${p.diffAdded}"` : null,
    p.diffRemoved ? `"diffRemovedColor": "${p.diffRemoved}"` : null,
    p.tint === undefined ? null : `"diffTint": "${p.tint}"`,
    p.word === undefined ? null : `"diffWordTint": "${p.word}"`,
    p.border === undefined ? null : `"diffBorder": ${p.border}`,
  ].filter(Boolean).join(', ')
