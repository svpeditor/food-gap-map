import { describe, expect, it } from 'vitest'
import { coverage, gapIndex, modelAid, nationalCoverage, regionPrice } from './metrics'
import { REGIONS } from './fixture'

describe('modelAid', () => {
  it('раскладывает объём пропорционально магазинам и сохраняет сумму', () => {
    const aid = modelAid(REGIONS, 1000)
    expect(aid.A + aid.B + aid.C).toBeCloseTo(1_000_000)
    expect(aid.A).toBeCloseTo(900_000)
    expect(aid.C).toBe(0)
  })
})

describe('coverage и gapIndex', () => {
  const aid = modelAid(REGIONS, 1000)
  it('покрытие = кг на малоимущего', () => {
    expect(coverage(REGIONS[0], aid)).toBeCloseTo(900_000 / 400_000)
  })
  it('разрыв по стране в среднем = 1 (взвешенно по малоимущим)', () => {
    const nat = nationalCoverage(REGIONS, aid)
    const poor = REGIONS.reduce((s, r) => s + r.poor, 0)
    const weighted = REGIONS.reduce((s, r) => s + gapIndex(r, aid, nat) * r.poor, 0) / poor
    expect(weighted).toBeCloseTo(1)
  })
  it('регион без помощи имеет разрыв 0', () => {
    const nat = nationalCoverage(REGIONS, aid)
    expect(gapIndex(REGIONS[2], aid, nat)).toBe(0)
  })
})

describe('regionPrice', () => {
  it('масштабирует цену кг индексом стоимости набора', () => {
    expect(regionPrice(REGIONS[2], 200)).toBeCloseTo(300)
  })
})
