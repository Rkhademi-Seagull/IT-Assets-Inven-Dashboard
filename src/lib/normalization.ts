import type { Asset, AssetCategory, WarrantyStatus } from '../types/asset'
import { classifyRegion } from './regions'

const clean = (value: string | undefined) => (value ?? '').replace(/^\uFEFF/, '').trim()
const title = (value: string) => value ? value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Unknown'

export function warrantyStatus(value: string, today = new Date('2026-09-11T00:00:00Z')): WarrantyStatus {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return 'Unknown'
  const difference = date.getTime() - today.getTime()
  if (difference < 0) return 'Expired'
  if (difference <= 1000 * 60 * 60 * 24 * 90) return 'Expiring soon'
  return 'Active'
}

export function deriveCategory(description: string, manufacturer: string, model: string): AssetCategory {
  const text = `${description} ${manufacturer} ${model}`.toLowerCase()
  if (/laptop|thinkpad|macbook|notebook|ultrabook|chromebook|framework|surface book|elitebook|precision|latitude|p16|t14|t15|p15|x1 carbon|ideapad|legion|cyborg|zenbook|vivobook|zbook/.test(text)) return 'Laptop'
  if (/desktop|optiplex|tower|macmini|poweredge|workstation|m720q|m710s|elitedesk|nuc/.test(text)) return 'Desktop'
  if (/monitor|display|u24|p24|p27|s27|s24|e24|u28|tv|screen/.test(text)) return 'Monitor'
  if (/dock|thunderbolt|40an|40b0|40ah|40af|40aj/.test(text)) return 'Dock'
  if (/printer|zebra zt|zq5|pm42|mfc-|laserjet|epson|videojet|domino|citizen|brother/.test(text)) return 'Printer'
  if (/iphone|ipad|galaxy|android|surface pro|pixel|moto|phone|tablet|ipod/.test(text)) return /tablet|ipad|surface pro/.test(text) ? 'Tablet' : 'Mobile'
  if (/rfid|reader|sled|antenna|scanner|rfd|tc\d|lotus|starflex|advan|ih40|ct40|tsl/.test(text)) return 'RFID'
  if (/router|switch|fortigate|ruckus|unifi|cisco|netgear|powerconnect|access point/.test(text)) return 'Network'
  if (/keyboard|mouse|webcam|camera|headset|speaker|ups|charger|cradle|lens|audio/.test(text)) return 'Accessory'
  return 'Other'
}

export function normalizeRows(rows: string[][]): Asset[] {
  const records = rows.slice(1)
  const used = new Map<string, number>()
  return records.map((columns, index) => {
    const [assetIdRaw, descriptionRaw, assignedToRaw, manufacturerRaw, modelRaw, serialRaw, processorRaw, driveRaw, ramRaw, warrantyRaw] = columns
    const assetId = clean(assetIdRaw)
    const duplicateIndex = used.get(assetId) ?? 0
    used.set(assetId, duplicateIndex + 1)
    const manufacturer = title(clean(manufacturerRaw))
    const model = clean(modelRaw) || 'Unknown model'
    const description = clean(descriptionRaw)
    const assignedTo = clean(assignedToRaw)
    const serialNumber = clean(serialRaw)
    const processor = clean(processorRaw)
    const category = deriveCategory(description, manufacturer, model)
    const searchText = [assetId, description, assignedTo, manufacturer, model, serialNumber, processor, classifyRegion(assetId), category].join(' ').toLowerCase()
    return {
      rowId: `${assetId || 'blank'}-${index}-${duplicateIndex}`,
      assetId: assetId || 'Unassigned', description: description || 'No description', assignedTo: assignedTo || 'Unassigned',
      manufacturer, model, serialNumber: serialNumber || 'No serial number', processor: processor || 'Not recorded',
      harddriveSize: clean(driveRaw) || 'Not recorded', ram: clean(ramRaw) || 'Not recorded', warrantyExpiration: clean(warrantyRaw),
      warrantyStatus: warrantyStatus(clean(warrantyRaw)), region: classifyRegion(assetId), category, searchText
    }
  })
}
