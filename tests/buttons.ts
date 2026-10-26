export type Found ={ text?: string; props: Record<string, unknown> }

export const labelled = async (ui: { findAll: (q: { type: 'Button' }) => Promise<Found[]> }, label: string): Promise<Found | undefined> =>
  (await ui.findAll({ type: 'Button' })).find(button => button.props.label === label)
