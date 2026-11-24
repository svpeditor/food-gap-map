import type { AidMap, AllocationRow, Region } from '../types'
import { lifted } from './effect'

export interface VatResult {
  /** дополнительный объём помощи, кг в год */
  extraKg: number
  /** ожидаемое снижение числа малоимущих, если прирост распределится как сейчас */
  lifted: number
  /** то же, если прирост направить по нужде (кг пропорционально малоимущим) */
  liftedIfByNeed: number
  rows: AllocationRow[]
}

/**
 * Сценарий «освобождение фудшеринга от НДС»: объём помощи растёт на growth (0,4 = +40 %, минимальная оценка МГУ).
 * Прирост раскладывается как текущая помощь; дополнительно считается вариант «прирост по нужде».
 */
export function vatScenario(regions: Region[], baseAid: AidMap, growth: number, coef: number): VatResult {
  const rows = regions.map((r) => {
    const kg = Math.max(0, growth) * (baseAid[r.iso] ?? 0)
    return { iso: r.iso, rub: 0, kg, lifted: lifted(r, kg, coef) }
  })
  const extraKg = rows.reduce((s, r) => s + r.kg, 0)
  const poor = regions.reduce((s, r) => s + r.poor, 0)
  const liftedIfByNeed = poor > 0 ? regions.reduce((s, r) => s + lifted(r, (extraKg * r.poor) / poor, coef), 0) : 0
  return { extraKg, lifted: rows.reduce((s, r) => s + r.lifted, 0), liftedIfByNeed, rows }
}
