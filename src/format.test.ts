import { describe, expect, it } from 'vitest'
import { fmtKg, fmtPeople, gapPhrase, plural, times } from './format'

describe('format', () => {
  it('склоняет «раз» правильно', () => {
    expect(times(2.5)).toBe('в 2,5 раза')
    expect(times(2)).toBe('в 2 раза')
    expect(times(5)).toBe('в 5 раз')
    expect(times(21)).toBe('в 21 раз')
    expect(times(139.1)).toBe('в 139 раз')
    expect(times(1.04)).toBe('в 1 раз')
  })
  it('фразы разрыва', () => {
    expect(gapPhrase(0)).toBe('помощи нет')
    expect(gapPhrase(1)).toBe('на уровне среднего по стране')
    expect(gapPhrase(0.25)).toBe('в 4 раза меньше среднего')
    expect(gapPhrase(3.5)).toBe('в 3,5 раза больше среднего')
  })
  it('числа и единицы', () => {
    expect(plural(1, ['регион', 'региона', 'регионов'])).toBe('регион')
    expect(plural(12, ['регион', 'региона', 'регионов'])).toBe('регионов')
    expect(plural(23, ['регион', 'региона', 'регионов'])).toBe('региона')
    expect(fmtKg(1500)).toBe('1,5 т')
    expect(fmtKg(500)).toBe('500 кг')
    expect(fmtPeople(129_000)).toBe('129 тыс.')
    expect(fmtPeople(3_910_000)).toBe('3,91 млн')
  })
})
