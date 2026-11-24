import { describe, expect, it } from 'vitest'
import { lifted } from './effect'
import { REGIONS } from './fixture'

const COEF = 0.2055
const C = REGIONS[2]

describe('lifted (коэффициент МГУ как полуэластичность)', () => {
  it('ноль кг — ноль эффекта', () => {
    expect(lifted(C, 0, COEF)).toBe(0)
  })
  it('монотонно растёт по кг и не превышает число малоимущих', () => {
    const a = lifted(C, 1_000, COEF), b = lifted(C, 10_000, COEF), c = lifted(C, 1e12, COEF)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeLessThanOrEqual(C.poor)
  })
  it('на малых объёмах ≈ коэф × доля бедных × кг', () => {
    const kg = 1_000
    const approx = COEF * (C.poverty_rate / 100) * kg
    expect(Math.abs(lifted(C, kg, COEF) - approx) / approx).toBeLessThan(1e-3)
  })
  it('+1 кг на душу снижает бедность на 1 − e^(−коэф) ≈ 18,6 %', () => {
    expect(lifted(C, C.population, COEF) / C.poor).toBeCloseTo(1 - Math.exp(-COEF))
  })
})
