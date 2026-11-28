import { describe, expect, it } from 'vitest'
import { allocate, summarize, toCertificates } from './allocate'
import { coverage, modelAid, regionPrice } from './metrics'
import { REGIONS } from './fixture'

const OPTS = { pricePerKg: 200, coef: 0.2055, baseAid: modelAid(REGIONS, 1000) }
const S = 10_000_000
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('allocate', () => {
  for (const s of ['current', 'need', 'equalize'] as const) {
    it(`${s}: распределяет ровно всю сумму, кг = ₽ / цена региона`, () => {
      const rows = allocate(REGIONS, S, s, OPTS)
      expect(sum(rows.map((r) => r.rub))).toBeCloseTo(S, 0)
      for (const row of rows) {
        const reg = REGIONS.find((r) => r.iso === row.iso)!
        expect(row.kg).toBeCloseTo(row.rub / regionPrice(reg, 200), 6)
        expect(row.rub).toBeGreaterThanOrEqual(0)
      }
    })
  }

  it('current: пропорционально магазинам', () => {
    const rows = allocate(REGIONS, S, 'current', OPTS)
    expect(rows.find((r) => r.iso === 'A')!.rub).toBeCloseTo(S * 0.9, 0)
    expect(rows.find((r) => r.iso === 'C')!.rub).toBe(0)
  })

  it('current с фактическими весами из выгрузки фонда', () => {
    const rows = allocate(REGIONS, S, 'current', { ...OPTS, currentWeights: { A: 1, B: 0, C: 3 } })
    expect(rows.find((r) => r.iso === 'C')!.rub).toBeCloseTo(S * 0.75, 0)
    expect(rows.find((r) => r.iso === 'B')!.rub).toBe(0)
  })

  it('need: килограммы пропорциональны числу малоимущих', () => {
    const rows = allocate(REGIONS, S, 'need', OPTS)
    const kgPerPoor = rows.map((row) => row.kg / REGIONS.find((r) => r.iso === row.iso)!.poor)
    expect(kgPerPoor[0]).toBeCloseTo(kgPerPoor[1], 6)
    expect(kgPerPoor[1]).toBeCloseTo(kgPerPoor[2], 6)
  })

  it('equalize: поднимает минимальное покрытие и не даёт денег тем, кто выше уровня', () => {
    const rows = allocate(REGIONS, S, 'equalize', OPTS)
    const after = Object.fromEntries(REGIONS.map((r) => [r.iso, (OPTS.baseAid[r.iso] ?? 0) + rows.find((x) => x.iso === r.iso)!.kg]))
    const minBefore = Math.min(...REGIONS.map((r) => coverage(r, OPTS.baseAid)))
    const minAfter = Math.min(...REGIONS.map((r) => coverage(r, after)))
    expect(minAfter).toBeGreaterThan(minBefore)
    // A покрыт лучше всех — ему ничего
    expect(rows.find((r) => r.iso === 'A')!.rub).toBe(0)
    // все, кто получил деньги, выровнены до одного уровня
    const funded = REGIONS.filter((r) => rows.find((x) => x.iso === r.iso)!.rub > 0)
    const levels = funded.map((r) => coverage(r, after))
    for (const l of levels) expect(l).toBeCloseTo(levels[0], 4)
  })

  it('ноль или отрицательная сумма — пустое распределение', () => {
    for (const s of ['current', 'need', 'equalize'] as const) {
      expect(sum(allocate(REGIONS, 0, s, OPTS).map((r) => r.rub))).toBe(0)
      expect(sum(allocate(REGIONS, -5, s, OPTS).map((r) => r.rub))).toBe(0)
    }
  })

  it('по нужде эффект больше, чем «как сейчас», если магазины в богатых регионах', () => {
    const cur = summarize(allocate(REGIONS, S, 'current', OPTS))
    const need = summarize(allocate(REGIONS, S, 'need', OPTS))
    expect(need.lifted).toBeGreaterThan(cur.lifted)
    expect(cur.rub).toBeCloseTo(S, 0)
  })
})

describe('сертификаты фонда', () => {
  for (const s of ['current', 'need', 'equalize'] as const) {
    it(`${s}: только регионы с магазинами X5, вся сумма распределена`, () => {
      const rows = allocate(REGIONS, S, s, { ...OPTS, onlyWithStores: true })
      expect(rows.find((r) => r.iso === 'C')!.rub).toBe(0)
      expect(sum(rows.map((r) => r.rub))).toBeCloseTo(S, 0)
    })
  }

  it('целые сертификаты: всего floor(сумма / номинал), каждому не меньше целой части', () => {
    const rows = allocate(REGIONS, 10_001_000, 'need', { ...OPTS, onlyWithStores: true })
    const certs = toCertificates(rows, 2500)
    expect(sum(Object.values(certs))).toBe(4000)
    for (const r of rows) {
      expect(Number.isInteger(certs[r.iso])).toBe(true)
      expect(certs[r.iso]).toBeGreaterThanOrEqual(Math.floor(r.rub / 2500))
      expect(certs[r.iso]).toBeLessThanOrEqual(Math.ceil(r.rub / 2500))
    }
  })

  it('номинал больше суммы: ни одного сертификата', () => {
    const rows = allocate(REGIONS, 1000, 'need', { ...OPTS, onlyWithStores: true })
    expect(sum(Object.values(toCertificates(rows, 2500)))).toBe(0)
  })
})
