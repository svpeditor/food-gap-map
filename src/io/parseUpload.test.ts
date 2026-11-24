import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Dataset } from '../types'
import { makeMatcher } from './matchRegion'
import { parseCsvText, parseNumber, rowsToAid } from './parseUpload'

const ds: Dataset = JSON.parse(readFileSync(new URL('../../public/data/regions.json', import.meta.url), 'utf8'))
const match = makeMatcher(ds.regions)

describe('parseNumber', () => {
  it('понимает пробелы, запятую, неразрывный пробел', () => {
    expect(parseNumber('1 234,5')).toBe(1234.5)
    expect(parseNumber('1\u{a0}234')).toBe(1234)
    expect(parseNumber('12.5')).toBe(12.5)
    expect(parseNumber(42)).toBe(42)
    expect(parseNumber('—')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
})

describe('parseCsvText', () => {
  it('разделитель ; и кавычки', () => {
    expect(parseCsvText('регион;кг\n"Москва";"1 000,5"\n')).toEqual([['регион', 'кг'], ['Москва', '1 000,5']])
  })
  it('разделитель , и экранированные кавычки', () => {
    expect(parseCsvText('region,kg\n"Респ. ""Алтай""",5\r\n')).toEqual([['region', 'kg'], ['Респ. "Алтай"', '5']])
  })
  it('табуляция', () => {
    expect(parseCsvText('Регион\tВес, кг\nТула\t10')).toEqual([['Регион', 'Вес, кг'], ['Тула', '10']])
  })
})

describe('rowsToAid', () => {
  it('находит колонки по заголовкам, суммирует повторы, собирает нераспознанные', () => {
    const res = rowsToAid([
      ['Дата', 'Субъект РФ', 'Объём, кг'],
      ['01.01', 'г. Москва', '1 000'],
      ['02.01', 'Москва', '500'],
      ['03.01', 'Тульская обл.', '250,5'],
      ['04.01', 'Неизвестия', '7'],
      ['05.01', 'Итого', '1757,5'],
    ], match)
    expect(res.aid['RU-MOW']).toBe(1500)
    expect(res.aid['RU-TUL']).toBe(250.5)
    expect(res.unmatched.map((u) => u.label)).toEqual(['Неизвестия'])
    expect(res.totalKg).toBe(1750.5)
    expect(res.rowsUsed).toBe(3)
  })
  it('тонны переводит в кг', () => {
    const res = rowsToAid([['Регион', 'Тонн'], ['Тула', '2,5']], match)
    expect(res.aid['RU-TUL']).toBe(2500)
  })
  it('без заголовка: первая колонка — регион, первая числовая — кг', () => {
    const res = rowsToAid([['Тула', '10'], ['Курская область', '5']], match)
    expect(res.aid['RU-TUL']).toBe(10)
    expect(res.aid['RU-KRS']).toBe(5)
  })
  it('пустой файл даёт понятную ошибку', () => {
    expect(() => rowsToAid([], match)).toThrow(/пуст/)
  })
})
