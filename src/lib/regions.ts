const REGION_RULES: Array<[string, string]> = [
  ['ECBRA', 'Brazil'], ['ECBRA', 'Brazil'], ['ECMEX', 'Mexico'], ['EM000', 'EMEA'],
  ['JP000', 'Japan'], ['LA000', 'Latin America'], ['USA', 'USA'], ['USD', 'USA'], ['USP', 'USA'], ['USPRT', 'USA'], ['US', 'USA'],
  ['AP', 'APAC'], ['EBRA', 'Brazil'], ['EC', 'Latin America'], ['RFID', 'Global']
]

export function classifyRegion(assetId: string): string {
  const normalized = assetId.trim().toUpperCase()
  const match = REGION_RULES
    .filter(([prefix]) => normalized.startsWith(prefix))
    .sort(([first], [second]) => second.length - first.length)[0]
  return match?.[1] ?? 'Unknown'
}

export function regionPrefixRules(): string[] { return [...REGION_RULES].sort(([a], [b]) => b.length - a.length).map(([prefix]) => prefix) }
