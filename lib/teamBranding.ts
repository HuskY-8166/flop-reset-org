export type TeamBrandingRow = {
  name?: string | null
  display_name?: string | null
  short_name?: string | null
  slug?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  logo_url?: string | null
  wordmark_style?: string | null
  active?: boolean | null
  brand_metadata?: Record<string, unknown> | null
}

export const ORG_BRAND = {
  pink: '#FF00A6',
  teal: '#42D7C0',
  lightGrey: '#BCBAB7',
  offBlack: '#2C2C2C',
  darkBlack: '#010B13',
} as const

const LEGACY_SECONDARY: Record<string, string> = {
  fracture: '#C042D7',
  frantic: '#CAFF00',
  frameshift: '#42A3D7',
}

export function teamSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function brandingForTeam(row: TeamBrandingRow) {
  const name = row.display_name?.trim() || row.name?.trim() || 'Flop Reset'
  const shortName = row.short_name?.trim() || name.replace(/^flop reset\s*[|\-]?\s*/i, '') || name
  const key = shortName.toLowerCase()
  return {
    name,
    shortName,
    slug: row.slug?.trim() || teamSlug(name),
    primaryColor: row.primary_color?.trim() || ORG_BRAND.pink,
    secondaryColor: row.secondary_color?.trim() || LEGACY_SECONDARY[key] || ORG_BRAND.teal,
    logoUrl: row.logo_url?.trim() || null,
    wordmarkStyle: row.wordmark_style?.trim() || 'default',
    active: row.active !== false,
    metadata: row.brand_metadata ?? {},
  }
}
