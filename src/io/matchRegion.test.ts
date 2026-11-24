import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Dataset } from '../types'
import { makeMatcher } from './matchRegion'

const ds: Dataset = JSON.parse(readFileSync(new URL('../../public/data/regions.json', import.meta.url), 'utf8'))
const match = makeMatcher(ds.regions)

describe('makeMatcher', () => {
  it('узнаёт все 85 официальных названий Росстата, ISO и ОКАТО', () => {
    for (const r of ds.regions) {
      expect(match(r.name), r.name).toBe(r.iso)
      expect(match(r.short), r.short).toBe(r.iso)
      expect(match(r.iso)).toBe(r.iso)
      expect(match(r.okato)).toBe(r.iso)
    }
  })

  const cases: [string, string | null][] = [
    ['г. Москва', 'RU-MOW'], ['Москва', 'RU-MOW'], ['МОСКВА ', 'RU-MOW'], ['Московская обл.', 'RU-MOS'],
    ['ru-mow', 'RU-MOW'], ['45000000000', 'RU-MOW'], ['45', 'RU-MOW'],
    ['СПб', 'RU-SPE'], ['г. Санкт-Петербург', 'RU-SPE'], ['Ленинградская область', 'RU-LEN'],
    ['Республика Татарстан', 'RU-TA'], ['Татарстан', 'RU-TA'], ['Башкирия', 'RU-BA'],
    ['Кемеровская область — Кузбасс', 'RU-KEM'], ['Кемеровская область', 'RU-KEM'], ['Кузбасс', 'RU-KEM'],
    ['ХМАО', 'RU-KHM'], ['Ханты-Мансийский автономный округ — Югра', 'RU-KHM'], ['ЯНАО', 'RU-YAN'], ['НАО', 'RU-NEN'],
    ['Тюменская область', 'RU-TYU'], ['Архангельская область', 'RU-ARK'],
    ['Чувашская Республика', 'RU-CU'], ['Чувашия', 'RU-CU'], ['Удмуртская Республика', 'RU-UD'],
    ['Республика Северная Осетия — Алания', 'RU-SE'], ['Северная Осетия', 'RU-SE'],
    ['Республика Саха (Якутия)', 'RU-SA'], ['Якутия', 'RU-SA'],
    ['Еврейская АО', 'RU-YEV'], ['ЕАО', 'RU-YEV'], ['Чукотка', 'RU-CHU'],
    ['Республика Алтай', 'RU-AL'], ['Алтайский край', 'RU-ALT'],
    ['Тыва', 'RU-TY'], ['Тува', 'RU-TY'], ['КЧР', 'RU-KC'], ['КБР', 'RU-KB'], ['Кабардино-Балкарская Республика', 'RU-KB'],
    ['Чеченская Республика', 'RU-CE'], ['Чечня', 'RU-CE'], ['Ставрополье', 'RU-STA'], ['Приморье', 'RU-PRI'],
    ['Орловская', 'RU-ORL'], ['Орёл', 'RU-ORL'], ['Тула', 'RU-TUL'], ['Ростов-на-Дону', 'RU-ROS'],
    ['Нижний Новгород', 'RU-NIZ'], ['Великий Новгород', 'RU-NGR'], ['Новгород', null], ['Ижевск', 'RU-UD'], ['Республика Крым', 'RU-CR'], ['г. Севастополь', 'RU-SEV'],
    ['Пермский край', 'RU-PER'], ['Нижегородская обл', 'RU-NIZ'], ['Mari El', null],
  ]
  for (const [input, iso] of cases) {
    it(`«${input}» -> ${iso}`, () => expect(match(input)).toBe(iso))
  }

  it('мусор и пустые строки -> null', () => {
    for (const s of ['', '   ', 'Итого', 'Россия', 'Российская Федерация', '123', 'область']) expect(match(s), s).toBeNull()
  })
})
