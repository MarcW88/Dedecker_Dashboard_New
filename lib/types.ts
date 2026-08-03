export interface Row {
  keyword: string;
  volume: number;
  category: string;
  subcategory?: string | null;
  cpc?: number;
  pos_dedecker: number | null;
  url_dedecker?: string;
  has_ai: boolean;
  dedecker_in_ai: boolean;
  position_bucket: string;
  scan_date?: string;
  [key: string]: unknown;
}

export interface CompMap {
  default: string[];
  [key: string]: string[];
}
