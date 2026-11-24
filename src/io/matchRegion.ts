import type { Region } from '../types'

const STOP = new Set([
  'республика', 'респ', 'область', 'обл', 'край', 'автономный', 'автономная', 'автономного', 'округ', 'округа', 'ао',
  'г', 'город', 'гор', 'федерального', 'значения', 'столица', 'российской', 'российская', 'федерации', 'федерация', 'рф', 'кроме',
])

/** Народные и сокращённые названия, которых нет в официальных. */
const ALIASES: Record<string, string[]> = {
  'RU-SPE': ['спб', 'питер'],
  'RU-KHM': ['хмао', 'югра', 'хмао югра'],
  'RU-YAN': ['янао', 'ямал'],
  'RU-NEN': ['нао'],
  'RU-YEV': ['еао'],
  'RU-BA': ['башкирия'],
  'RU-TY': ['тува'],
  'RU-KC': ['кчр'],
  'RU-KB': ['кбр'],
  'RU-SE': ['рсо алания', 'осетия'],
  'RU-SA': ['якутия', 'саха якутия'],
  'RU-CHU': ['чукотка'],
  'RU-STA': ['ставрополье'],
  'RU-PRI': ['приморье'],
  'RU-CE': ['чечня'],
  'RU-KEM': ['кузбасс'],
  'RU-UD': ['удмуртская'],
  'RU-KO': ['коми'],
  'RU-CU': ['чувашия'],
}

/** Административные центры: пресс-релизы и выгрузки часто дают город, а не субъект. */
const CAPITALS: Record<string, string> = {
  'RU-MUR': 'Мурманск',
  'RU-KR': 'Петрозаводск',
  'RU-ARK': 'Архангельск',
  'RU-NEN': 'Нарьян-Мар',
  'RU-VLG': 'Вологда',
  'RU-KO': 'Сыктывкар',
  'RU-KGD': 'Калининград',
  'RU-PSK': 'Псков',
  'RU-NGR': 'Великий Новгород',
  'RU-YAR': 'Ярославль',
  'RU-KOS': 'Кострома',
  'RU-KIR': 'Киров',
  'RU-PER': 'Пермь',
  'RU-SMO': 'Смоленск',
  'RU-TVE': 'Тверь',
  'RU-IVA': 'Иваново',
  'RU-NIZ': 'Нижний Новгород',
  'RU-UD': 'Ижевск',
  'RU-BRY': 'Брянск',
  'RU-KLU': 'Калуга',
  'RU-VLA': 'Владимир',
  'RU-ME': 'Йошкар-Ола',
  'RU-TA': 'Казань',
  'RU-BA': 'Уфа',
  'RU-KRS': 'Курск',
  'RU-ORL': 'Орёл',
  'RU-TUL': 'Тула',
  'RU-RYA': 'Рязань',
  'RU-CU': 'Чебоксары',
  'RU-ULY': 'Ульяновск',
  'RU-SAM': 'Самара',
  'RU-BEL': 'Белгород',
  'RU-VOR': 'Воронеж',
  'RU-LIP': 'Липецк',
  'RU-TAM': 'Тамбов',
  'RU-MO': 'Саранск',
  'RU-PNZ': 'Пенза',
  'RU-ORE': 'Оренбург',
  'RU-CR': 'Симферополь',
  'RU-ROS': 'Ростов-на-Дону',
  'RU-VGG': 'Волгоград',
  'RU-SAR': 'Саратов',
  'RU-KDA': 'Краснодар',
  'RU-AD': 'Майкоп',
  'RU-STA': 'Ставрополь',
  'RU-KL': 'Элиста',
  'RU-AST': 'Астрахань',
  'RU-KC': 'Черкесск',
  'RU-KB': 'Нальчик',
  'RU-SE': 'Владикавказ',
  'RU-IN': 'Магас',
  'RU-CE': 'Грозный',
  'RU-DA': 'Махачкала',
  'RU-YAN': 'Салехард',
  'RU-KHM': 'Ханты-Мансийск',
  'RU-SVE': 'Екатеринбург',
  'RU-TYU': 'Тюмень',
  'RU-CHE': 'Челябинск',
  'RU-KGN': 'Курган',
  'RU-OMS': 'Омск',
  'RU-TOM': 'Томск',
  'RU-KYA': 'Красноярск',
  'RU-IRK': 'Иркутск',
  'RU-NVS': 'Новосибирск',
  'RU-KEM': 'Кемерово',
  'RU-KK': 'Абакан',
  'RU-BU': 'Улан-Удэ',
  'RU-ZAB': 'Чита',
  'RU-ALT': 'Барнаул',
  'RU-AL': 'Горно-Алтайск',
  'RU-TY': 'Кызыл',
  'RU-SA': 'Якутск',
  'RU-CHU': 'Анадырь',
  'RU-MAG': 'Магадан',
  'RU-KAM': 'Петропавловск-Камчатский',
  'RU-KHA': 'Хабаровск',
  'RU-AMU': 'Благовещенск',
  'RU-YEV': 'Биробиджан',
  'RU-SAK': 'Южно-Сахалинск',
  'RU-PRI': 'Владивосток',
}

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t))
}

const key = (s: string) => tokens(s).sort().join(' ')

/**
 * Возвращает функцию: строка из выгрузки (название, ISO 3166-2 или ОКАТО) -> ISO региона или null.
 * Порядок: код -> точное совпадение слов -> единственный регион, чьё название содержит все слова строки.
 */
export function makeMatcher(regions: Region[]): (input: unknown) => string | null {
  const byIso = new Map(regions.map((r) => [r.iso.toUpperCase(), r.iso]))
  const byOkato = new Map<string, string>()
  const exact = new Map<string, string>()
  const tokenSets: { iso: string; set: Set<string> }[] = []

  for (const r of regions) {
    byOkato.set(r.okato, r.iso)
    byOkato.set(r.okato.slice(0, 2), byOkato.get(r.okato.slice(0, 2)) ?? r.iso)
    const official = r.name.replace(/\([^)]*\)/g, ' ')
    for (const variant of [official, r.short, CAPITALS[r.iso] ?? '', ...(ALIASES[r.iso] ?? [])]) {
      const k = key(variant)
      if (!k) continue
      exact.set(k, r.iso)
      tokenSets.push({ iso: r.iso, set: new Set(k.split(' ')) })
    }
  }
  // двузначный ОКАТО Архангельской и Тюменской относится к области «с АО»; берём саму область
  byOkato.set('11', 'RU-ARK')
  byOkato.set('71', 'RU-TYU')

  return (input: unknown) => {
    if (input === null || input === undefined) return null
    const raw = String(input).trim()
    if (!raw) return null
    const up = raw.toUpperCase()
    if (/^RU-[A-Z]{1,3}$/.test(up)) return byIso.get(up) ?? null
    if (/^\d{2}$|^\d{11}$/.test(raw)) return byOkato.get(raw) ?? null
    // сначала строка целиком, потом без скобок: «Архангельская область (кроме Ненецкого АО)»
    const keys = [key(raw), key(raw.replace(/\([^)]*\)/g, ' '))].filter(Boolean)
    for (const k of keys) {
      const hit = exact.get(k)
      if (hit) return hit
    }
    for (const k of keys) {
      const words = k.split(' ')
      const candidates = new Set(tokenSets.filter((t) => words.every((w) => t.set.has(w))).map((t) => t.iso))
      if (candidates.size === 1) return [...candidates][0]
    }
    return null
  }
}
