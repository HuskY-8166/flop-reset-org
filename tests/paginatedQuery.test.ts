import assert from 'node:assert/strict'
import { fetchAllPages } from '../lib/paginatedQuery.ts'

const source = Array.from({ length: 2_505 }, (_, id) => ({ id: id + 1 }))
const calls: Array<[number, number]> = []
const rows = await fetchAllPages(async (from, to) => {
  calls.push([from, to])
  return { data: source.slice(from, to + 1), error: null }
}, 1_000)

assert.equal(rows.length, source.length)
assert.equal(rows.at(-1)?.id, 2_505)
assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]])

await assert.rejects(
  fetchAllPages(async () => ({ data: null, error: { message: 'boom' } })),
  /boom/,
)

console.log('Paginated archive query tests passed.')
