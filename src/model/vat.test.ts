import { describe, expect, it } from 'vitest'
import { vatScenario } from './vat'
import { modelAid } from './metrics'
import { REGIONS } from './fixture'

describe('vatScenario', () => {
  const base = modelAid(REGIONS, 1000)
  it('доп. объём = рост × текущий, раскладывается как текущая помощь', () => {
    const v = vatScenario(REGIONS, base, 0.4, 0.2055)
    expect(v.extraKg).toBeCloseTo(400_000)
    expect(v.rows.find((r) => r.iso === 'A')!.kg).toBeCloseTo(360_000)
    expect(v.rows.find((r) => r.iso === 'C')!.kg).toBe(0)
    expect(v.lifted).toBeGreaterThan(0)
  })
  it('если тот же прирост направить по нужде, эффект больше', () => {
    const v = vatScenario(REGIONS, base, 0.4, 0.2055)
    expect(v.liftedIfByNeed).toBeGreaterThan(v.lifted)
  })
  it('нулевой рост — нулевой эффект', () => {
    const v = vatScenario(REGIONS, base, 0, 0.2055)
    expect(v.extraKg).toBe(0)
    expect(v.lifted).toBe(0)
  })
})
