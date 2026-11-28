import { useEffect, useMemo, useRef, useState } from 'react'
import type { AidMap, Dataset, Strategy } from './types'
import { gapIndex, modelAid, nationalCoverage } from './model/metrics'
import { lifted } from './model/effect'
import { makeMatcher } from './io/matchRegion'
import { fmtInt, fmtNum, fmtPeople, plural, times } from './format'
import { LAYERS, type LayerId } from './ui/layers'
import { useHashParam } from './ui/useHashState'
import { TileMap } from './ui/TileMap'
import { Legend } from './ui/Legend'
import { RegionCard } from './ui/RegionCard'
import { RussiaCard } from './ui/RussiaCard'
import { Allocator } from './ui/Allocator'
import { VatScenario } from './ui/VatScenario'
import { Upload } from './ui/Upload'
import { Method } from './ui/Method'
import { REPO_URL } from './config'

export function App() {
  const [ds, setDs] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('./data/regions.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(setDs)
      .catch((e) => setError(String(e.message ?? e)))
  }, [])
  if (error)
    return (
      <p className="boot error" role="alert">
        Не удалось загрузить данные ({error}). Обновите страницу.
      </p>
    )
  if (!ds) return <p className="boot muted">Загружаю данные Росстата…</p>
  return <Main ds={ds} />
}

const STRATS: Strategy[] = ['current', 'need', 'equalize']

function Main({ ds }: { ds: Dataset }) {
  const regions = ds.regions
  const p = ds.meta.params
  const [layerId, setLayerId] = useHashParam('l', 'gap')
  const [sel, setSel] = useHashParam('r', '')
  const [sumStr, setSumStr] = useHashParam('sum', '10000000')
  const [stratStr, setStratStr] = useHashParam('st', 'equalize')
  const [tonnes, setTonnes] = useState(p.baseline_tonnes)
  const [price, setPrice] = useState(p.price_per_kg)
  const [upload, setUpload] = useState<{ aid: AidMap; name: string } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const layer = LAYERS.find((l) => l.id === layerId) ?? LAYERS[0]
  const strategy: Strategy = STRATS.includes(stratStr as Strategy) ? (stratStr as Strategy) : 'equalize'
  const rub = Math.max(0, Number(sumStr) || 0)
  const match = useMemo(() => makeMatcher(regions), [regions])
  const aid = useMemo(() => (upload ? upload.aid : modelAid(regions, tonnes)), [upload, regions, tonnes])
  const national = useMemo(() => nationalCoverage(regions, aid), [regions, aid])
  const ctx = useMemo(() => ({ aid, national }), [aid, national])
  const gaps = useMemo(
    () =>
      regions
        .map((r) => ({ region: r, gap: gapIndex(r, aid, national) }))
        .sort((a, b) => a.gap - b.gap || b.region.poor - a.region.poor),
    [regions, aid, national],
  )
  const selected = regions.find((r) => r.iso === sel) ?? null

  const select = (iso: string) => {
    setSel(iso)
    if (window.matchMedia('(max-width: 1099px)').matches) setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const f = useMemo(() => {
    const totalPoor = regions.reduce((s, r) => s + r.poor, 0)
    const totalStores = regions.reduce((s, r) => s + r.stores_est, 0)
    const poorest = [...regions].sort((a, b) => b.poverty_rate - a.poverty_rate).slice(0, 10)
    const storesPoorest = poorest.reduce((s, r) => s + r.stores_est, 0)
    const poorInPoorest = poorest.reduce((s, r) => s + r.poor, 0)
    const noStores = poorest.filter((r) => r.stores_est < 1).map((r) => r.short)
    const under = gaps.filter((g) => g.gap < 0.5)
    const underPoor = under.reduce((s, g) => s + g.region.poor, 0)
    const totalKg = regions.reduce((s, r) => s + (aid[r.iso] ?? 0), 0)
    const now = regions.reduce((s, r) => s + lifted(r, aid[r.iso] ?? 0, p.msu_coef), 0)
    const byNeed = regions.reduce((s, r) => s + lifted(r, (totalKg * r.poor) / totalPoor, p.msu_coef), 0)
    return { totalPoor, totalStores, poorest, storesPoorest, poorInPoorest, noStores, under, underPoor, ratio: now > 0 ? byNeed / now : 0 }
  }, [regions, gaps, aid, p.msu_coef])

  return (
    <>
      <a className="skip" href="#map">
        К карте
      </a>
      <header className="top">
        <a className="brand" href="#">
          Карта продовольственного разрыва
        </a>
        <nav aria-label="Разделы">
          <a href="#map">Карта</a>
          <a href="#allocate">Распределить сумму</a>
          <a href="#vat">Без НДС</a>
          <a href="#data">Ваши данные</a>
          <a href="#method">Как считаем</a>
        </nav>
      </header>

      {upload && (
        <div className="banner" role="status">
          Расчёты идут по данным «{upload.name}».{' '}
          <button className="link-btn" onClick={() => setUpload(null)}>
            Вернуться к модели
          </button>
        </div>
      )}

      <main>
        <section id="map" className="hero" aria-labelledby="h1">
          <div className="hero-text">
            <h1 id="h1">Куда отправить следующий килограмм помощи</h1>
            <p className="lead">
              Фонд «Выручаем» и МГУ выяснили: каждый дополнительный килограмм продуктовой помощи на душу в год связан со снижением бедности в регионе на
              20,55 %. Значит, важно, куда он попадёт. Помощь собирают в магазинах X5, а магазинов меньше там, где бедных больше. Карта показывает, куда направить деньги фонда, чтобы закрыть этот разрыв.
            </p>
            <ul className="findings">
              <li>
                В десяти регионах с самой высокой долей бедных живёт {fmtNum((f.poorInPoorest / f.totalPoor) * 100, 0)} % малоимущих страны, а магазинов X5
                там около <b>{fmtInt(f.storesPoorest)}</b>, это {fmtNum((f.storesPoorest / f.totalStores) * 100, 1)} % сети.
                {f.noStores.length > 0 && ' ' + f.noStores.join(' и ') + ': ни одного.'}
              </li>
              <li>
                В <b>{f.under.length}</b> {plural(f.under.length, ['регионе', 'регионах', 'регионах'])} помощи на одного малоимущего как минимум вдвое меньше
                среднего. Там живёт {fmtPeople(f.underPoor)} малоимущих, {fmtNum((f.underPoor / f.totalPoor) * 100, 0)} % от всех.
              </li>
              <li>
                Если тот же объём распределить по числу малоимущих, снижение бедности по модели МГУ будет <b>{times(f.ratio)}</b> больше.
              </li>
            </ul>
          </div>

          <div className="map-grid">
            <div className="map-col">
              <div className="layer-switch" role="tablist" aria-label="Что показать на карте">
                {LAYERS.map((l) => (
                  <button key={l.id} role="tab" aria-selected={l.id === layer.id} className={l.id === layer.id ? 'is-on' : ''} onClick={() => setLayerId(l.id as LayerId)}>
                    {l.title}
                  </button>
                ))}
              </div>
              <p className="layer-q">{layer.question}{layer.id === 'gap' && !upload ? ' (модель: помощь пропорциональна магазинам X5)' : ''}</p>
              <TileMap regions={regions} layer={layer} ctx={ctx} selected={selected?.iso ?? null} onSelect={select} />
              <div className="map-foot">
                <Legend layer={layer} />
                <label className="finder">
                  <span className="sr-only">Найти регион</span>
                  <select value={selected?.iso ?? ''} onChange={(e) => select(e.target.value)}>
                    <option value="">Найти регион</option>
                    {[...regions].sort((a, b) => a.short.localeCompare(b.short, 'ru')).map((r) => (
                      <option key={r.iso} value={r.iso}>
                        {r.short}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="card-col" ref={cardRef}>
              {selected ? (
                <RegionCard
                  ds={ds}
                  region={selected}
                  ctx={ctx}
                  rank={gaps.findIndex((g) => g.region.iso === selected.iso) + 1}
                  usingUpload={!!upload}
                  onClose={() => setSel('')}
                />
              ) : (
                <RussiaCard
                  worst={(upload ? gaps : gaps.filter((g) => g.region.stores_est >= 1)).slice(0, 8)}
                  noStores={upload ? [] : gaps.filter((g) => g.region.stores_est < 1).map((g) => g.region)}
                  usingUpload={!!upload}
                  onSelect={select}
                />
              )}
            </div>
          </div>
        </section>

        <section id="allocate" className="block" aria-labelledby="h-alloc">
          <div className="block-head">
            <h2 id="h-alloc">Распределить сумму</h2>
            <p>
              Сколько людей может выйти из бедности, если ту же сумму направить по-разному. Пожертвования покупателей фонд оставляет в регионе сбора, а этот
              расчёт для денег, которые фонд распределяет сам: продуктовые наборы через НКО или сертификаты в магазины X5.
            </p>
          </div>
          <div className="assumptions">
            <label>
              Помощи сейчас, т в год
              <input type="number" min={1} step={50} value={tonnes} disabled={!!upload} onChange={(e) => setTonnes(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label>
              Цена 1 кг продуктов, ₽
              <input type="number" min={10} step={5} value={price} onChange={(e) => setPrice(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <p className="muted small">
              {upload ? 'Объём взят из вашей выгрузки. ' : 'По умолчанию: итоги «Пятёрочки» за 2024 год. '}Цена по умолчанию: «Перекрёсток», 52 т на ~12 млн ₽.
            </p>
          </div>
          <Allocator
            regions={regions}
            aid={aid}
            usingUpload={!!upload}
            pricePerKg={price}
            coef={p.msu_coef}
            rub={rub}
            setRub={(n) => setSumStr(String(n))}
            strategy={strategy}
            setStrategy={setStratStr}
            onSelect={(iso) => {
              select(iso)
              document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </section>

        <section id="vat" className="block" aria-labelledby="h-vat">
          <div className="block-head">
            <h2 id="h-vat">Если отменить НДС на передачу продуктов</h2>
            <p>
              Сейчас бизнесу дешевле утилизировать еду, чем отдать её: НДС при передаче не возмещается. Здесь можно посчитать, сколько помощи и в каких регионах
              даст законопроект, и скопировать готовую справку.
            </p>
          </div>
          <VatScenario regions={regions} aid={aid} params={p} usingUpload={!!upload} />
        </section>

        <section id="data" className="block" aria-labelledby="h-data">
          <div className="block-head">
            <h2 id="h-data">Ваши данные</h2>
            <p>
              Загрузите выгрузку платформы продовольственной помощи по регионам, и карта покажет фактический разрыв вместо модели. Все расчёты на странице
              пересчитаются.
            </p>
          </div>
          <Upload regions={regions} match={match} activeName={upload?.name ?? null} onApply={(a, name) => setUpload({ aid: a, name })} onReset={() => setUpload(null)} />
        </section>

        <section id="method" className="block" aria-labelledby="h-method">
          <div className="block-head">
            <h2 id="h-method">Как считаем</h2>
          </div>
          <Method ds={ds} />
        </section>
      </main>

      <footer className="foot">
        <p>
          Сделано для благотворительного фонда X5 «Выручаем» на конкурс «Вайбкодинг добрых дел». Данные: Росстат (ЕМИСС), © участники OpenStreetMap (ODbL),
          пресс-релизы X5. <a href={REPO_URL}>Код и данные на GitHub</a>.
        </p>
      </footer>
    </>
  )
}
