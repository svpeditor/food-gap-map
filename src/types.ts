export type Brand = 'pyaterochka' | 'perekrestok' | 'chizhik'

export interface Fact {
  iso: string
  city: string
  kg: number
  program: string
  kind: string
  period: string
  url: string
}

export interface Region {
  iso: string
  okato: string
  name: string
  short: string
  fd: string
  tile: [number, number]
  population: number
  poverty_rate: number
  poverty_series: Record<string, number>
  poor: number
  basket: number
  basket_latest: { value: number; month: string }
  price_index: number
  stores_by_brand: Record<Brand, number>
  stores_osm: Record<Brand, number>
  stores_est: number
  /** X5 в регионе не работает: почему точки OSM не считаются */
  x5_absent?: string
  facts: Fact[]
}

export interface Quote {
  url: string
  text: string
}

export interface Params {
  msu_coef: number
  vat_growth_min: number
  vat_cost_per_100: [number, number]
  baseline_tonnes: number
  price_per_kg: number
}

export interface Dataset {
  meta: {
    built_at: string
    params: Params
    x5_stores_official: Record<Brand, number>
    x5_stores_by_fd: Record<string, Record<Brand, number>>
    x5_regions_official: number
    x5_fd_regional: Record<string, { brand: Brand; date: string; sources: string[]; stores: Record<string, number> }>
    x5_absent: Record<string, string>
    osm: { fetched_at: string; total_shops: number; unmatched: number }
    years: { poverty: string; population: string; basket: string }
    quotes: Record<string, Quote>
    programs: Record<string, { program: string; kind: string; period: string; total_kg: number; url: string }>
  }
  russia: {
    poverty_rate: number
    poverty_series: Record<string, number>
    population: number
    basket: number
    basket_latest: { value: number; month: string }
    name: string
  }
  regions: Region[]
}

/** кг помощи в год по регионам (ISO -> кг) */
export type AidMap = Record<string, number>

export type Strategy = 'current' | 'need' | 'equalize'

export interface AllocationRow {
  iso: string
  rub: number
  kg: number
  lifted: number
}
