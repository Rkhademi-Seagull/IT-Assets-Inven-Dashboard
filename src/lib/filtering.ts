import type { Asset, FilterState } from '../types/asset'

import { expandRegionSelection } from './regions'

export function filterAssets(assets: Asset[], filters: FilterState): Asset[] {
  const keyword = filters.keyword.trim().toLowerCase()
  // if a region group is selected, expand to concrete region names
  const selectedRegions = filters.region ? expandRegionSelection(filters.region) : []
  return assets.filter((asset) =>
    (!filters.manufacturer || asset.manufacturer === filters.manufacturer) &&
    (!filters.model || asset.model === filters.model) &&
    (!filters.region || selectedRegions.includes(asset.region) || asset.region === filters.region) &&
    (!filters.category || asset.category === filters.category) &&
    (!filters.assignment || (filters.assignment === 'Assigned' ? asset.assignedTo !== 'Unassigned' : asset.assignedTo === 'Unassigned')) &&
    (!filters.warranty || asset.warrantyStatus === filters.warranty) &&
    (!keyword || asset.searchText.includes(keyword))
  )
}

export function uniqueValues(assets: Asset[], field: keyof Asset): string[] {
  return [...new Set(assets.map((asset) => String(asset[field])).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
