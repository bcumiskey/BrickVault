// Core LEGO data types based on Rebrickable API structure
export interface LegoSet {
  set_num: string;
  name: string;
  year: number;
  theme_id: number;
  num_parts: number;
  set_img_url?: string;
  set_url?: string;
  current_value?: number;
  avg_price?: number;
  price_trend?: 'UP' | 'DOWN' | 'STABLE';
  last_sold_price?: number;
  market_value?: number;
}

export interface LegoPart {
  part_num: string;
  name: string;
  part_cat_id: number;
  part_url?: string;
  part_img_url?: string;
  prints?: string[];
  molds?: string[];
  alternates?: string[];
}

export interface LegoColor {
  id: number;
  name: string;
  rgb: string;
  is_trans: boolean;
}

export interface SetInventory {
  id: number;
  inv_part_id: number;
  part: LegoPart;
  color: LegoColor;
  quantity: number;
  is_spare: boolean;
  element_id?: string;
  num_sets: number;
}

export interface Theme {
  id: number;
  parent_id?: number;
  name: string;
}

export interface LegoMoc {
  moc_num: string;
  name: string;
  designer_name: string;
  designer_url?: string;
  num_parts: number;
  difficulty?: string;
  moc_img_url?: string;
  moc_url?: string;
  theme_id?: number;
  year?: number;
  tags?: string[];
  description?: string;
}

export interface LegoMinifigure {
  fig_num: string;
  name: string;
  set_num?: string;
  set_name?: string;
  num_parts: number;
  fig_img_url?: string;
  fig_url?: string;
  year?: number;
  theme_id?: number;
}

// Acquisition tracking
export interface Acquisition {
  id: string;
  date?: string;
  price?: number;
  source: 'RETAIL' | 'GIFT' | 'BULK_LOT' | 'SECONDHAND' | 'TRADE' | 'OTHER';
  source_detail?: string;
  notes?: string;
}

// Collection management types
export interface CollectionSet {
  id: string;
  set_num: string;
  set_data: LegoSet;
  status: 'NISB' | 'COMPLETE_WITH_BOX' | 'COMPLETE_NO_BOX' | 'INCOMPLETE' | 'PARTS_ONLY' | 'SOLD';
  completeness_percentage: number;
  has_original_box: boolean;
  has_instructions: boolean;
  instructions_url?: string;
  storage_location?: string;
  display_location?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  estimated_selling_price?: number;
  condition_notes?: string;
  images?: string[];
  notes?: string;
  custom_fields?: Record<string, unknown>;
  tags?: string[];
  quantity: number;
  acquisitions: Acquisition[];
  retired: boolean;
  retirement_year?: number;
  retail_price?: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionMinifigure {
  id: string;
  fig_num: string;
  minifig_data: LegoMinifigure;
  status: 'COMPLETE' | 'INCOMPLETE' | 'PARTS_ONLY';
  completeness_percentage: number;
  storage_location?: string;
  condition: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  images?: string[];
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  estimated_selling_price?: number;
  notes?: string;
  custom_fields?: Record<string, unknown>;
  tags?: string[];
  source: 'REBRICKABLE' | 'BRICKLINK' | 'MANUAL';
  quantity: number;
  acquisitions: Acquisition[];
  category: 'SET_FIGURE' | 'CMF' | 'LOOSE';
  parent_set_id?: string;
  parent_set_num?: string;
  retired: boolean;
  created_at: string;
  updated_at: string;
}

export interface CollectionMoc {
  id: string;
  moc_num: string;
  moc_data: LegoMoc;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  completion_percentage: number;
  parts_owned: number;
  parts_needed: number;
  estimated_cost: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  instructions_url?: string;
  notes?: string;
  images?: string[];
  custom_fields?: Record<string, unknown>;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface PartInventory {
  id: string;
  part_num: string;
  color_id: number;
  quantity: number;
  storage_location: string;
  condition: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  images?: string[];
  estimated_value_per_piece?: number;
  notes?: string;
  custom_fields?: Record<string, unknown>;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface StorageLocation {
  id: string;
  name: string;
  type: 'DRAWER' | 'BIN' | 'SHELF' | 'BOX' | 'DISPLAY';
  parent_location_id?: string;
  description?: string;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  type: 'SET' | 'MOC' | 'PART';
  item_num: string;
  item_data: LegoSet | LegoMoc | LegoPart;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  max_price?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT';
  options?: string[];
  required: boolean;
  applies_to: ('SETS' | 'MOCS' | 'MINIFIGURES' | 'PARTS')[];
  default_value?: unknown;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Collection analytics
export interface CollectionAnalytics {
  total_sets: number;
  total_set_copies: number;
  total_minifigures: number;
  total_minifig_copies: number;
  total_mocs: number;
  total_parts: number;
  total_value: number;
  total_cost: number;
  profit_loss: number;
  retired_sets: number;
  active_sets: number;
  set_fig_count: number;
  cmf_count: number;
  loose_fig_count: number;
  completion_stats: {
    complete: number;
    incomplete: number;
    nisb: number;
  };
}
