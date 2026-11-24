import type { AidMap, Region } from '../types'
import { gapIndex } from '../model/metrics'
import { fmtInt, fmtNum, fmtPeople } from '../format'

export type LayerId = 'gap' | 'poverty' | 'poor' | 'basket' | 'stores'

export interface LayerCtx {
  aid: AidMap
  national: number
}

export interface Layer {
  id: LayerId
  title: string
  question: string
  value: (r: Region, ctx: LayerCtx) => number
  /** границы классов: значение попадает в класс i, если bins[i-1] <= v < bins[i] */
  bins: number[]
  colors: string[]
  labels: string[]
  format: (v: number) => string
}

const BEET = ['#F8E4EA', '#EFB6C6', '#DB7A97', '#B83A62', '#7E1538']
const MUSTARD = ['#FBF1D6', '#F3D98F', '#E2B544', '#B9861A', '#7A5608']
const TEAL = ['#EEF1F0', '#CFE9E2', '#8FCBBB', '#3E9C88', '#1B6457']

export const LAYERS: Layer[] = [
  {
    id: 'gap',
    title: 'Разрыв',
    question: 'Сколько помощи приходится на одного малоимущего по сравнению со средним по стране',
    value: (r, c) => gapIndex(r, c.aid, c.national),
    bins: [1e-9, 0.25, 0.5, 0.9, 1.1, 2],
    colors: ['#5E0B26', '#A3214A', '#D0607F', '#EDB3C2', '#E6EAE8', '#8CCBBB', '#1F7A6B'],
    labels: ['нет', '< ¼', '¼–½', '½–0,9', '≈ 1', '1,1–2', '> 2'],
    format: (v) => (v <= 0 ? 'помощи нет' : fmtNum(v, 2) + ' от среднего'),
  },
  {
    id: 'poverty',
    title: 'Бедность',
    question: 'Доля населения с доходами ниже границы бедности, 2025',
    value: (r) => r.poverty_rate,
    bins: [5, 7, 9, 12],
    colors: BEET,
    labels: ['< 5 %', '5–7', '7–9', '9–12', '> 12 %'],
    format: (v) => fmtNum(v) + ' %',
  },
  {
    id: 'poor',
    title: 'Малоимущие',
    question: 'Сколько человек живёт ниже границы бедности',
    value: (r) => r.poor,
    bins: [30e3, 60e3, 120e3, 250e3],
    colors: BEET,
    labels: ['< 30 тыс.', '30–60', '60–120', '120–250', '> 250 тыс.'],
    format: (v) => fmtPeople(v),
  },
  {
    id: 'basket',
    title: 'Цена продуктов',
    question: 'Стоимость минимального набора продуктов на человека в месяц, 2025',
    value: (r) => r.basket,
    bins: [6500, 7500, 8500, 10000],
    colors: MUSTARD,
    labels: ['< 6,5 тыс. ₽', '6,5–7,5', '7,5–8,5', '8,5–10', '> 10 тыс. ₽'],
    format: (v) => fmtInt(v) + ' ₽',
  },
  {
    id: 'stores',
    title: 'Магазины X5',
    question: '«Пятёрочка», «Перекрёсток» и «Чижик» в регионе, оценка',
    value: (r) => r.stores_est,
    bins: [1, 50, 200, 600],
    colors: TEAL,
    labels: ['нет', '1–50', '50–200', '200–600', '> 600'],
    format: (v) => (v < 1 ? 'нет' : '≈ ' + fmtInt(v)),
  },
]

export function classOf(layer: Layer, v: number): number {
  let i = 0
  while (i < layer.bins.length && v >= layer.bins[i]) i++
  return i
}

export function colorOf(layer: Layer, v: number): string {
  return layer.colors[classOf(layer, v)]
}

/** Белый или тёмный текст поверх заливки */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return l < 0.33 ? '#FFFFFF' : '#18242B'
}
