import { useEffect, useState } from 'react'

/** Состояние в адресе (#r=RU-IN&l=gap...), чтобы ссылкой можно было поделиться ровно тем видом. */
export function readHash(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''))
}

export function useHashParam(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => readHash().get(key) ?? fallback)
  useEffect(() => {
    const p = readHash()
    if (value === fallback) p.delete(key)
    else p.set(key, value)
    const next = p.toString()
    const url = window.location.pathname + window.location.search + (next ? '#' + next : '')
    window.history.replaceState(null, '', url)
  }, [key, value, fallback])
  return [value, setValue]
}
