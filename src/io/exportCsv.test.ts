import { describe, expect, it } from 'vitest'
import { toCsv } from './exportCsv'

describe('toCsv', () => {
  it('BOM, точка с запятой, кавычки, числа с запятой', () => {
    const csv = toCsv([['Регион', 'Сумма'], ['Республика "Алтай"', 1234.5], ['Тула; Тульская', 10]])
    expect(csv).toBe('\u{feff}Регион;Сумма\r\n"Республика ""Алтай""";1234,5\r\n"Тула; Тульская";10\r\n')
  })
})
