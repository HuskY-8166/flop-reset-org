import RivalryDetail from '../page'

export const dynamic = 'force-dynamic'

export default async function StableRivalryRoute(props: {
  params: Promise<{ opponent: string; slug: string }>
  searchParams?: Promise<{ competition?: string; format?: string }>
}) {
  const { opponent } = await props.params
  return RivalryDetail({
    params: Promise.resolve({ opponent }),
    searchParams: props.searchParams,
  })
}
