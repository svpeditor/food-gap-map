const nf = (digits: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits })

export const fmtInt = (n: number) => nf(0).format(Math.round(n))
export const fmtNum = (n: number, digits = 1) => nf(digits).format(n)
export const fmtPct = (n: number, digits = 1) => nf(digits).format(n) + ' %'

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(Math.round(n)) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export function fmtPeople(n: number): string {
  if (n >= 1e6) return fmtNum(n / 1e6, 2) + ' млн'
  if (n >= 1e4) return fmtInt(n / 1e3) + ' тыс.'
  if (n >= 1e3) return fmtNum(n / 1e3, 1) + ' тыс.'
  return fmtInt(n)
}

export function fmtRub(n: number): string {
  if (n >= 1e9) return fmtNum(n / 1e9, 2) + ' млрд ₽'
  if (n >= 1e6) return fmtNum(n / 1e6, n >= 1e7 ? 1 : 2) + ' млн ₽'
  if (n >= 1e3) return fmtInt(n / 1e3) + ' тыс. ₽'
  return fmtInt(n) + ' ₽'
}

export function fmtKg(kg: number): string {
  if (kg >= 1e6) return fmtNum(kg / 1e6, 2) + ' тыс. т'
  if (kg >= 1e4) return fmtInt(kg / 1e3) + ' т'
  if (kg >= 1e3) return fmtNum(kg / 1e3, 1) + ' т'
  return fmtInt(kg) + ' кг'
}

/** «в 2,5 раза», «в 5 раз», «в 21 раз»: дробные числа требуют родительного падежа единственного числа */
export function times(x: number): string {
  const v = x >= 10 ? Math.round(x) : Math.round(x * 10) / 10
  const word = Number.isInteger(v) ? plural(v, ['раз', 'раза', 'раз']) : 'раза'
  return 'в ' + fmtNum(v, 1) + ' ' + word
}

/** «в 3,2 раза меньше среднего» / «на уровне среднего» */
export function gapPhrase(gap: number): string {
  if (gap <= 0) return 'помощи нет'
  if (gap >= 0.9 && gap <= 1.1) return 'на уровне среднего по стране'
  if (gap < 1) return times(1 / gap) + ' меньше среднего'
  return times(gap) + ' больше среднего'
}
