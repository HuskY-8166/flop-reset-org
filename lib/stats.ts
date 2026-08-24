export function competitionRanks<T>(
  rows: T[],
  signature: (row: T) => string,
) {
  let previous = ''
  let rank = 0

  return rows.map((row, index) => {
    const current = signature(row)
    if (index === 0 || current !== previous) rank = index + 1
    previous = current
    return { row, rank }
  })
}

export function normalizeIdentity(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '')
}
