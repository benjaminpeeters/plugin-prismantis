export type PrismantisMarkdownArgs<Surface> = {
  surface: Surface
  text: string
  columns: number
}

export type Prismantis<Surface, Drawing> = {
  markdown: (args: PrismantisMarkdownArgs<Surface>) => Promise<Drawing | undefined>
}

export type TurnRole = 'answer' | 'first' | 'step'

export type TurnMarks = Record<string, TurnRole>

declare module 'claude-code' {
  interface EngineInterface {
    prismantis: Prismantis<RenderSurface, RenderElement>
  }
  interface PluginState {
    prismantis: {
      formulas: Record<string, unknown>
      dir: string
      unfolded: string[]
      sent: { text: string; at: number }[]
      turnEnds: { durationMs: number; at: number }[]
      replies: { durationMs: number; at: number; text: string }[]
      turnMarks: TurnMarks
      turnStart: number | null
      setupAt: number
      setupFocus: string
      setupLand: string
      foundPaths: string[]
      drawn: StateFamily<number>
    }
  }
}
