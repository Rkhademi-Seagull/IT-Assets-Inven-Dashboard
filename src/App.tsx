import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Filter, LayoutGrid, MapPinned, Search, SlidersHorizontal, X } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import worldMap from 'world-atlas/countries-110m.json'
import type { GeoJsonObject } from 'geojson'
import { parseCsv } from './lib/csv'
import { exportAssets } from './lib/export'
import { filterAssets, uniqueValues } from './lib/filtering'
import { normalizeRows } from './lib/normalization'
import { buildRegionGroups } from './lib/regions'
import type { Asset, FilterState } from './types/asset'
import { EMPTY_FILTERS } from './types/asset'
import './styles.css'

const PAGE_SIZE = 12
const columns = ['assetId', 'description', 'assignedTo', 'manufacturer', 'model', 'region', 'category', 'warrantyStatus'] as const
type ColumnKey = typeof columns[number]
const labels: Record<string, string> = { assetId: 'Asset ID', description: 'Description', assignedTo: 'Assigned to', manufacturer: 'Manufacturer', model: 'Model', region: 'Region', category: 'Category', warrantyStatus: 'Warranty' }

function useDebouncedValue(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer) }, [value, delay])
  return debounced
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function RegionSelect({ label, value, groups, onChange }: { label: string; value: string; groups: { group: string; countries: string[] }[]; onChange: (value: string) => void }) {
  return <label className="filter-field"><span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">All regions</option>
      {groups.map((g) => <optgroup key={g.group} label={g.group}>
        <option key={`${g.group}-all`} value={g.group}>All {g.group}</option>
        {g.countries.map((country) => <option key={country} value={country}>{country}</option>)}
      </optgroup>)}
    </select>
  </label>
}

const mapPositions: Record<string, [number, number]> = {
  APAC: [139, 32], USA: [-100, 39], US: [-100, 39], EMEA: [18, 44], 'Latin America': [-62, -14], LATAM: [-62, -14], Brazil: [-52, -10], Japan: [138, 36],
  Mexico: [-102, 23], Global: [18, -26], Unknown: [28, -42]
}

function CoverageMap({ totals, groups, selectedRegion, onSelect }: { totals: Array<[string, number]>; groups?: { group: string; countries: string[] }[]; selectedRegion: string; onSelect: (region: string) => void }) {
  const max = Math.max(...totals.map(([, total]) => total), 1)
  return <div className="coverage-layout">
    <div className="coverage-map" aria-label="Interactive world map showing aggregated inventory by region">
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 125 }} width={800} height={360}>
        <Geographies geography={worldMap as unknown as GeoJsonObject}>
          {({ geographies }) => geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} fill="#f8fbfc" stroke="#91aeb8" strokeWidth={0.45} />)}
        </Geographies>
        {totals.map(([region, total]) => {
          const position = mapPositions[region] ?? mapPositions.Unknown
          const size = 18 + (total / max) * 14
          return <Marker key={region} coordinates={position}>
            <g className={`world-marker ${selectedRegion === region ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`${region}: ${total} assets`} onClick={() => onSelect(region)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(region) }}>
              <circle r={size + 4} fill="#fff" opacity=".9" />
              <circle r={size} fill={selectedRegion === region ? '#d46b31' : '#1268a9'} stroke="#fff" strokeWidth="2" />
              <text textAnchor="middle" y="4" fill="#fff" fontSize="11" fontWeight="700">{total}</text>
              <text textAnchor="middle" y={size + 15} fill="#254e60" fontSize="9" fontWeight="700">{region}</text>
            </g>
          </Marker>
        })}
      </ComposableMap>
    </div>
    <div className="coverage-legend">
      <div className="coverage-legend-heading"><MapPinned size={15} /><strong>Regional totals</strong></div>
      {groups ? groups.map((g) => <div key={g.group} className="legend-group">
        <button className={`legend-row ${selectedRegion === g.group ? 'selected' : ''}`} onClick={() => onSelect(g.group)}><span><i />{g.group}</span><strong>{(totals.find(t => t[0] === g.group)?.[1] ?? 0).toLocaleString()}</strong></button>
        <div className="legend-children">{g.countries.map((c) => <button key={c} className={`legend-row child ${selectedRegion === c ? 'selected' : ''}`} onClick={() => onSelect(c)}><span>{c}</span><strong>{(totals.find(t => t[0] === c)?.[1] ?? 0).toLocaleString()}</strong></button>)}</div>
      </div>) : totals.map(([region, total]) => <button key={region} className={`legend-row ${selectedRegion === region ? 'selected' : ''}`} onClick={() => onSelect(region)}><span><i />{region}</span><strong>{total.toLocaleString()}</strong></button>)}
      {!totals.length && <p className="muted">No regions match these filters.</p>}
    </div>
  </div>
}

function App() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: keyof Asset; direction: 'asc' | 'desc' }>({ key: 'assetId', direction: 'asc' })
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>([...columns])
  const [selected, setSelected] = useState<Asset | null>(null)
  const [showColumns, setShowColumns] = useState(false)
  const returnFocusRef = useRef<HTMLButtonElement | null>(null)
  const triggerRef = returnFocusRef
  const debouncedKeyword = useDebouncedValue(filters.keyword)

  useEffect(() => {
    fetch('/data/assets.csv').then((response) => { if (!response.ok) throw new Error('CSV request failed'); return response.text() }).then((text) => { setAssets(normalizeRows(parseCsv(text))); setStatus('ready') }).catch(() => { setError('The inventory file could not be loaded. Check that public/data/assets.csv exists and is valid.'); setStatus('error') })
  }, [])
  useEffect(() => { if (selected) { returnFocusRef.current = document.activeElement as HTMLButtonElement; return } returnFocusRef.current?.focus() }, [selected])
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])

  const activeFilters = { ...filters, keyword: debouncedKeyword }
  const filtered = useMemo(() => filterAssets(assets, activeFilters), [assets, activeFilters.manufacturer, activeFilters.model, activeFilters.region, activeFilters.category, activeFilters.assignment, activeFilters.warranty, activeFilters.keyword])
  const manufacturers = useMemo(() => uniqueValues(assets, 'manufacturer'), [assets])
  const modelOptions = useMemo(() => uniqueValues(filters.manufacturer ? assets.filter((asset) => asset.manufacturer === filters.manufacturer) : assets, 'model'), [assets, filters.manufacturer])
  const regions = useMemo(() => uniqueValues(assets, 'region'), [assets])
  const regionGroups = useMemo(() => buildRegionGroups(regions), [regions])
  const categories = useMemo(() => uniqueValues(assets, 'category'), [assets])
  const sorted = useMemo(() => [...filtered].sort((a, b) => { const first = String(a[sort.key]); const second = String(b[sort.key]); return (first.localeCompare(second, undefined, { numeric: true }) || a.rowId.localeCompare(b.rowId)) * (sort.direction === 'asc' ? 1 : -1) }), [filtered, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const regionTotals = useMemo(() => Object.entries(filtered.reduce<Record<string, number>>((result, asset) => { result[asset.region] = (result[asset.region] ?? 0) + 1; return result }, {})).sort(([, a], [, b]) => b - a), [filtered])
  // Build grouped totals for map: top-level groups sum their member countries
  const groupedTotals = useMemo(() => {
    const counts = Object.fromEntries(regionTotals)
    const groups = regionGroups
    const totals: Array<[string, number]> = []
    for (const g of groups) {
      const sum = g.countries.reduce((s, c) => s + (counts[c] ?? 0), 0)
      if (sum > 0) totals.push([g.group, sum])
      // also include country entries as their own totals so legend can show them
      for (const c of g.countries) {
        const cCount = counts[c] ?? 0
        if (cCount > 0) totals.push([c, cCount])
      }
    }
    return totals.sort(([, a], [, b]) => b - a)
  }, [regionTotals, regionGroups])

  const assignedCount = filtered.filter((asset) => asset.assignedTo !== 'Unassigned').length
  const expiredCount = filtered.filter((asset) => asset.warrantyStatus === 'Expired').length

  const updateFilter = (key: keyof FilterState, value: string) => { setFilters((current) => ({ ...current, [key]: value, ...(key === 'manufacturer' ? { model: '' } : {}) })); setPage(1) }
  const toggleColumn = (key: ColumnKey) => setVisibleColumns((current) => current.includes(key) ? current.filter((column) => column !== key) : [...current, key])
  const changeSort = (key: keyof Asset) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))

  if (status === 'loading') return <div className="center-state"><div className="spinner" /><h1>Loading inventory</h1><p>Preparing normalized asset records...</p></div>
  if (status === 'error') return <div className="center-state error-state"><h1>Inventory unavailable</h1><p>{error}</p></div>

  return <div className="app-shell">
    <header className="topbar"><div><p className="eyebrow">OPERATIONS / ASSET CONTROL</p><h1>Inventory intelligence</h1></div><div className="topbar-meta"><span className="live-dot" /> Live dataset <span className="divider" /> Updated from CSV</div></header>
    <main>
      <section className="intro"><div><h2>Asset inventory</h2><p>Search, segment, and inspect the hardware estate across every operating region.</p></div><button className="button primary" onClick={() => exportAssets(filtered)}><Download size={16} /> Export filtered CSV</button></section>
      <section className="filter-panel" aria-label="Inventory filters"><div className="filter-heading"><div><Filter size={16} /><strong>Filter inventory</strong><span className="filter-count">{filtered.length.toLocaleString()} matching assets</span></div><button className="button ghost" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}><X size={14} /> Clear filters</button></div><div className="filter-grid"><label className="filter-field search-field"><span>Keyword search</span><div className="input-wrap"><Search size={15} /><input value={filters.keyword} onChange={(event) => updateFilter('keyword', event.target.value)} placeholder="ID, description, owner, serial, processor..." /></div></label><SelectFilter label="Manufacturer" value={filters.manufacturer} options={manufacturers} onChange={(value) => updateFilter('manufacturer', value)} /><SelectFilter label="Model" value={filters.model} options={modelOptions} onChange={(value) => updateFilter('model', value)} /><RegionSelect label="Region" value={filters.region} groups={regionGroups} onChange={(value) => updateFilter('region', value)} /><SelectFilter label="Category" value={filters.category} options={categories} onChange={(value) => updateFilter('category', value)} /><SelectFilter label="Assignment" value={filters.assignment} options={['Assigned', 'Unassigned']} onChange={(value) => updateFilter('assignment', value)} /><SelectFilter label="Warranty" value={filters.warranty} options={['Active', 'Expiring soon', 'Expired', 'Unknown']} onChange={(value) => updateFilter('warranty', value)} /></div></section>
      <section className="kpi-grid" aria-label="Inventory summary"><article className="kpi accent-blue"><span>Total assets</span><strong>{filtered.length.toLocaleString()}</strong><small>Across {regionTotals.length} regions</small></article><article className="kpi accent-green"><span>Assigned</span><strong>{assignedCount.toLocaleString()}</strong><small>{filtered.length ? Math.round(assignedCount / filtered.length * 100) : 0}% of filtered inventory</small></article><article className="kpi accent-orange"><span>Warranty attention</span><strong>{expiredCount.toLocaleString()}</strong><small>Expired coverage</small></article><article className="kpi accent-purple"><span>Manufacturers</span><strong>{new Set(filtered.map((asset) => asset.manufacturer)).size}</strong><small>Normalized suppliers</small></article></section>
      <section className="region-section"><div className="section-title"><div><p className="eyebrow">REGION SNAPSHOT</p><h2>Inventory footprint</h2></div><span className="muted">Aggregated by region · click a marker to filter</span></div><CoverageMap totals={groupedTotals} groups={regionGroups} selectedRegion={filters.region} onSelect={(region) => updateFilter('region', filters.region === region ? '' : region)} /></section>
      <section className="table-section"><div className="table-toolbar"><div><p className="eyebrow">INVENTORY REGISTER</p><h2>Assets <span>{sorted.length.toLocaleString()}</span></h2></div><div className="toolbar-actions"><div className="column-menu"><button className="button ghost" onClick={() => setShowColumns(!showColumns)}><SlidersHorizontal size={15} /> Columns</button>{showColumns && <div className="column-popover">{columns.map((column) => <label key={column}><input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => toggleColumn(column)} />{labels[column]}</label>)}</div>}</div></div></div><div className="table-wrap"><table><caption className="sr-only">Inventory assets with normalized details and warranty statuses</caption><thead><tr>{visibleColumns.map((column) => <th key={column} scope="col"><button onClick={() => changeSort(column as keyof Asset)}>{labels[column]} {sort.key === column ? (sort.direction === 'asc' ? '↑' : '↓') : ''}</button></th>)}<th scope="col">View</th></tr></thead><tbody>{pageRows.length ? pageRows.map((asset) => <tr key={asset.rowId}><>{visibleColumns.map((column) => <td key={column}>{column === 'assetId' ? <strong className="asset-id">{asset.assetId}</strong> : column === 'warrantyStatus' ? <span className={`status status-${asset.warrantyStatus.toLowerCase().replace(' ', '-')}`}>{asset.warrantyStatus}</span> : column === 'category' ? <span className="category-pill">{asset.category}</span> : asset[column]}</td>)}</><td><button className="view-button" ref={triggerRef} onClick={() => setSelected(asset)} aria-label={`View ${asset.assetId}`}>→</button></td></tr>) : <tr><td className="empty-cell" colSpan={visibleColumns.length + 1}><LayoutGrid size={28} /><strong>No assets match these filters</strong><span>Clear a filter or try a broader keyword.</span></td></tr>}</tbody></table></div><div className="pagination"><span>Showing {sorted.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()}</span><div><button className="button ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span className="page-number">Page {page} of {pageCount}</span><button className="button ghost" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Next</button></div></div></section>
    </main>
    <div className="sr-only" aria-live="polite">{filtered.length} assets match the current filters.</div>
    {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">ASSET DETAIL</p><h2 id="detail-title">{selected.assetId}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close asset details"><X size={18} /></button></div><div className="detail-status"><span className={`status status-${selected.warrantyStatus.toLowerCase().replace(' ', '-')}`}>{selected.warrantyStatus}</span><span className="category-pill">{selected.category}</span><span className="region-badge">{selected.region}</span></div><dl className="detail-list">{[['Description', selected.description], ['Assigned to', selected.assignedTo], ['Manufacturer', selected.manufacturer], ['Model', selected.model], ['Serial number', selected.serialNumber], ['Processor', selected.processor], ['Storage', selected.harddriveSize], ['RAM', selected.ram], ['Warranty expiration', selected.warrantyExpiration || 'Not recorded']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></aside></div>}
  </div>
}

export default App
