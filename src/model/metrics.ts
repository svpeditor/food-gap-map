import type { AidMap, Region } from '../types'

/** Модель «как сейчас»: помощь остаётся там, где собрана, то есть пропорциональна числу магазинов X5. */
export function modelAid(regions: Region[], tonnes: number): AidMap {
  const total = regions.reduce((s, r) => s + r.stores_est, 0)
  const out: AidMap = {}
  for (const r of regions) out[r.iso] = total > 0 ? (tonnes * 1000 * r.stores_est) / total : 0
  return out
}

/** кг помощи в год на одного малоимущего */
export function coverage(r: Region, aid: AidMap): number {
  return r.poor > 0 ? (aid[r.iso] ?? 0) / r.poor : 0
}

export function nationalCoverage(regions: Region[], aid: AidMap): number {
  const poor = regions.reduce((s, r) => s + r.poor, 0)
  const kg = regions.reduce((s, r) => s + (aid[r.iso] ?? 0), 0)
  return poor > 0 ? kg / poor : 0
}

/** Разрыв: покрытие региона относительно среднего по стране. 1 = как в среднем, 0 = помощи нет. */
export function gapIndex(r: Region, aid: AidMap, national: number): number {
  return national > 0 ? coverage(r, aid) / national : 0
}

/** Цена 1 кг продуктовой помощи в регионе: базовая цена × индекс стоимости минимального набора продуктов. */
export function regionPrice(r: Region, pricePerKg: number): number {
  return pricePerKg * r.price_index
}
