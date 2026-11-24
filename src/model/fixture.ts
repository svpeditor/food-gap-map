import type { Region } from '../types'

const base = {
  okato: '', name: '', fd: 'Тест', tile: [0, 0] as [number, number], poverty_series: {}, basket: 7000,
  basket_latest: { value: 7000, month: 'январь 2026' }, stores_osm: { pyaterochka: 0, perekrestok: 0, chizhik: 0 }, facts: [],
}

function region(iso: string, population: number, rate: number, stores: number, priceIndex = 1): Region {
  return {
    ...base, iso, short: iso, population, poverty_rate: rate, poor: (rate / 100) * population,
    price_index: priceIndex, stores_est: stores,
    stores_by_brand: { pyaterochka: stores, perekrestok: 0, chizhik: 0 },
  }
}

/** A: богатый, много магазинов; B: средний; C: бедный, без магазинов, дорогой */
export const REGIONS: Region[] = [
  region('A', 10_000_000, 4, 900),
  region('B', 2_000_000, 8, 100),
  region('C', 500_000, 20, 0, 1.5),
]
