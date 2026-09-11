const REGION_RULES: Array<[string, string]> = [
  ['ECBRA', 'Brazil'], ['ECBRA', 'Brazil'], ['ECMEX', 'Mexico'], ['EM000', 'EMEA'],
  ['JP000', 'Japan'], ['LA000', 'Latin America'], ['USA', 'USA'], ['USD', 'USA'], ['USP', 'USA'], ['USPRT', 'USA'], ['US', 'USA'],
  ['AP', 'APAC'], ['EBRA', 'Brazil'], ['EC', 'Latin America'], ['RFID', 'Global']
]

// Top-level groups and their member region names as produced by classifyRegion
const REGION_GROUPS: Record<string, string[]> = {
  'US': ['USA'],
  'LATAM': ['Latin America', 'Brazil', 'Mexico'],
  'EMEA': ['EMEA'],
  'APAC': ['APAC', 'Japan'],
  'Global': ['Global']
}

export function classifyRegion(assetId: string): string {
  const normalized = assetId.trim().toUpperCase()
  const match = REGION_RULES
    .filter(([prefix]) => normalized.startsWith(prefix))
    .sort(([first], [second]) => second.length - first.length)[0]
  return match?.[1] ?? 'Unknown'
}

export function regionPrefixRules(): string[] { return [...REGION_RULES].sort(([a], [b]) => b.length - a.length).map(([prefix]) => prefix) }

// Given a selected region value (either a top-level group or a country/region name),
// return the list of concrete region names to match against asset.region
export function expandRegionSelection(value: string | undefined): string[] {
  if (!value) return []
  // exact group name
  const group = Object.keys(REGION_GROUPS).find((g) => g.toLowerCase() === value.toLowerCase())
  if (group) return REGION_GROUPS[group]
  // otherwise assume value is a concrete region name
  return [value]
}

// Build a list of groups and the countries present in the provided asset regions
export function buildRegionGroups(availableRegions: string[]): { group: string; countries: string[] }[] {
  const result: { group: string; countries: string[] }[] = []
  const seen = new Set<string>(availableRegions.filter(Boolean))
  // For each defined group, collect present countries
  for (const [group, members] of Object.entries(REGION_GROUPS)) {
    const present = members.filter((m) => seen.has(m))
    if (present.length) {
      result.push({ group, countries: present.sort((a, b) => a.localeCompare(b)) })
      // remove added members from seen
      present.forEach((p) => seen.delete(p))
    }
  }
  // Any leftover regions that didn't match a group go under 'Other'
  if (seen.size) {
    result.push({ group: 'Other', countries: [...seen].sort((a, b) => a.localeCompare(b)) })
  }
  return result
}

