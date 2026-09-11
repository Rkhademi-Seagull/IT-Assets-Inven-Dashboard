export type WarrantyStatus = 'Active' | 'Expiring soon' | 'Expired' | 'Unknown'
export type AssetCategory = 'Laptop' | 'Desktop' | 'Mobile' | 'Monitor' | 'Dock' | 'Printer' | 'Network' | 'RFID' | 'Tablet' | 'Accessory' | 'Other'

export interface Asset {
  rowId: string
  assetId: string
  description: string
  assignedTo: string
  manufacturer: string
  model: string
  serialNumber: string
  processor: string
  harddriveSize: string
  ram: string
  warrantyExpiration: string
  warrantyStatus: WarrantyStatus
  region: string
  category: AssetCategory
  searchText: string
}

export interface FilterState {
  manufacturer: string
  model: string
  region: string
  category: string
  assignment: string
  warranty: string
  keyword: string
}

export const EMPTY_FILTERS: FilterState = {
  manufacturer: '', model: '', region: '', category: '', assignment: '', warranty: '', keyword: ''
}
