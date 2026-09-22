export type PageResult<T> = { data: T[] | null; error: { message?: string } | null }

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('pageSize must be a positive integer')
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1)
    if (result.error) throw new Error(result.error.message || 'Paginated query failed')
    const page = result.data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
