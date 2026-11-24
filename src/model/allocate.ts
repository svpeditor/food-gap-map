import type { AidMap, AllocationRow, Region, Strategy } from '../types'
import { lifted } from './effect'
import { regionPrice } from './metrics'

export interface AllocateOptions {
  /** базовая цена 1 кг помощи по России, ₽ */
  pricePerKg: number
  /** коэффициент МГУ (0,2055) */
  coef: number
  /** текущая помощь, кг в год: нужна стратегии «выровнять» */
  baseAid: AidMap
}

export const STRATEGIES: Record<Strategy, { title: string; hint: string }> = {
  current: { title: 'Как сейчас', hint: 'Пропорционально магазинам X5: где собрали, туда и отдали' },
  need: { title: 'По нужде', hint: 'Каждому малоимущему поровну килограммов' },
  equalize: { title: 'Закрыть разрыв', hint: 'Сначала регионам, где помощи на малоимущего меньше всего' },
}

/** Распределяет сумму rub (₽) по регионам выбранной стратегией. Возвращает строку на каждый регион. */
export function allocate(regions: Region[], rub: number, strategy: Strategy, opts: AllocateOptions): AllocationRow[] {
  const price = (r: Region) => regionPrice(r, opts.pricePerKg)
  const eligible = regions.filter((r) => r.poor > 0 && r.population > 0 && price(r) > 0)
  const shares = new Map<string, number>()

  if (rub > 0 && eligible.length) {
    if (strategy === 'current') {
      const total = eligible.reduce((s, r) => s + r.stores_est, 0)
      if (total > 0) for (const r of eligible) shares.set(r.iso, (rub * r.stores_est) / total)
    } else if (strategy === 'need') {
      const total = eligible.reduce((s, r) => s + r.poor * price(r), 0)
      for (const r of eligible) shares.set(r.iso, (rub * r.poor * price(r)) / total)
    } else {
      const base = (r: Region) => opts.baseAid[r.iso] ?? 0
      const cost = (level: number) => eligible.reduce((s, r) => s + Math.max(0, level * r.poor - base(r)) * price(r), 0)
      let lo = 0
      let hi = Math.max(1e-9, ...eligible.map((r) => base(r) / r.poor))
      while (cost(hi) < rub) hi *= 2
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2
        if (cost(mid) < rub) lo = mid
        else hi = mid
      }
      const raw = eligible.map((r) => [r.iso, Math.max(0, hi * r.poor - base(r)) * price(r)] as const)
      const total = raw.reduce((s, [, v]) => s + v, 0)
      for (const [iso, v] of raw) shares.set(iso, total > 0 ? (v * rub) / total : 0)
    }
  }

  return regions.map((r) => {
    const rubR = shares.get(r.iso) ?? 0
    const kg = rubR > 0 ? rubR / price(r) : 0
    return { iso: r.iso, rub: rubR, kg, lifted: lifted(r, kg, opts.coef) }
  })
}

export function summarize(rows: AllocationRow[]): { rub: number; kg: number; lifted: number; regions: number } {
  return rows.reduce(
    (s, r) => ({ rub: s.rub + r.rub, kg: s.kg + r.kg, lifted: s.lifted + r.lifted, regions: s.regions + (r.rub > 0 ? 1 : 0) }),
    { rub: 0, kg: 0, lifted: 0, regions: 0 },
  )
}
