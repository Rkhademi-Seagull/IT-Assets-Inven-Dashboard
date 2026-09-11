import { describe, expect, it } from 'vitest'
import { parseCsv } from '../lib/csv'
import { filterAssets } from '../lib/filtering'
import { normalizeRows, warrantyStatus, deriveCategory } from '../lib/normalization'
import { classifyRegion } from '../lib/regions'
import { EMPTY_FILTERS, type Asset } from '../types/asset'

const rows = (overrides: string[] = []) => [['Asset ID', 'Description', 'Assigned To', 'Manufacturer', 'Model', 'Serial #', 'Processor', 'Harddrive Size', 'RAM', 'Warranty Expiration Date'], ['AP001', 'QA laptop', 'User One', ' dell ', 'Latitude', 'SERIAL-A', 'i5', '256 GB', '16', '2026-12-01'], ...overrides.map((value) => [value, 'test device', '', 'Lenovo', 'T14', 'synthetic-serial', 'i7', '512 GB', '16', '2027-01-01'])]

const asset = (overrides: Partial<Asset> = {}): Asset => ({ rowId: 'row', assetId: 'AP001', description: 'QA laptop', assignedTo: 'User One', manufacturer: 'Dell', model: 'Latitude', serialNumber: 'synthetic-serial', processor: 'i5', harddriveSize: '256 GB', ram: '16', warrantyExpiration: '2027-01-01', warrantyStatus: 'Active', region: 'APAC', category: 'Laptop', searchText: 'ap001 qa laptop user one dell latitude synthetic-serial i5 apac laptop', ...overrides })

describe('CSV parsing', () => {
  it('parses quoted commas and skips blank rows', () => expect(parseCsv('Asset ID,Description\nA1,"Dock, Gen 2"\n\n')).toEqual([['Asset ID', 'Description'], ['A1', 'Dock, Gen 2']]))
})

describe('normalization', () => {
  it('uses longest-prefix-first region classification', () => expect(classifyRegion('USPRT0001')).toBe('USA'))
  it('handles USA special subcategories and unknown regions', () => { expect(classifyRegion('USA00022')).toBe('USA'); expect(classifyRegion('ZZ0001')).toBe('Unknown') })
  it('handles blank and duplicate asset IDs without collisions', () => { const normalized = normalizeRows(rows(['', 'AP001'])); expect(normalized[1].assetId).toBe('Unassigned'); expect(normalized[0].rowId).not.toBe(normalized[2].rowId) })
  it('normalizes manufacturer names and derives categories', () => { expect(normalizeRows(rows())[0].manufacturer).toBe('Dell'); expect(deriveCategory('Thunderbolt dock', 'Lenovo', '40B0')).toBe('Dock') })
  it('calculates warranty statuses', () => { expect(warrantyStatus('2026-09-01')).toBe('Expired'); expect(warrantyStatus('2026-10-01')).toBe('Expiring soon'); expect(warrantyStatus('2027-01-01')).toBe('Active'); expect(warrantyStatus('')).toBe('Unknown') })
})

describe('filtering', () => {
  it('combines manufacturer, model, assignment, and keyword filters', () => { const assets = [asset(), asset({ rowId: 'two', model: 'T14', manufacturer: 'Lenovo', searchText: 'us001 test device unassigned lenovo t14 serial b i7 usa laptop', assignedTo: 'Unassigned', region: 'USA' })]; expect(filterAssets(assets, { ...EMPTY_FILTERS, manufacturer: 'Lenovo', model: 'T14', assignment: 'Unassigned', keyword: 'usa' })).toHaveLength(1) })
  it('searches all normalized keyword fields', () => { const fields = ['AP001', 'QA laptop', 'User One', 'Dell', 'Latitude', 'synthetic-serial', 'i5', 'APAC', 'Laptop']; fields.forEach((field) => expect(filterAssets([asset()], { ...EMPTY_FILTERS, keyword: field })).toHaveLength(1)) })
  it('returns the table empty state data when no rows match and supports clear filters', () => { expect(filterAssets([asset()], { ...EMPTY_FILTERS, keyword: 'missing' })).toHaveLength(0); expect(filterAssets([asset()], EMPTY_FILTERS)).toHaveLength(1) })
  it('supports region selection as a filter', () => { expect(filterAssets([asset(), asset({ rowId: 'two', region: 'USA' })], { ...EMPTY_FILTERS, region: 'USA' })).toHaveLength(1) })
})
