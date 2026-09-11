import type { Asset } from '../types/asset'
import { escapeCsv } from './csv'

export function exportAssets(assets: Asset[]): void {
  const headers = ['Asset ID', 'Description', 'Assigned To', 'Manufacturer', 'Model', 'Serial #', 'Region', 'Category', 'Warranty Status']
  const rows = assets.map((asset) => [asset.assetId, asset.description, asset.assignedTo, asset.manufacturer, asset.model, asset.serialNumber, asset.region, asset.category, asset.warrantyStatus])
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'filtered-assets.csv'; anchor.click(); URL.revokeObjectURL(url)
}
