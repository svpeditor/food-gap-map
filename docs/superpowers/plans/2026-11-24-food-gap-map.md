# Карта продовольственного разрыва: план реализации

> Исполнение: inline в этой сессии (superpowers:executing-plans). Субагенты не используются (правило проекта: агенты только по согласованию). Шаги отмечаются `- [ ]`.

**Цель:** статическое веб-приложение, где 85 регионов РФ показаны по нужде (Росстат) и присутствию помощи X5, с калькуляторами распределения суммы, сценарием «без НДС» и загрузкой выгрузки фонда.

**Архитектура:** Python-скрипты собирают `public/data/regions.json` из ЕМИСС и OSM. Фронтенд на Vite + React + TS: чистая модель в `src/model`, ввод и вывод в `src/io`, интерфейс в `src/ui`. Деплой на GitHub Pages через Actions.

**Стек:** Python 3.12 (stdlib + certifi + openpyxl), pytest; Node 22, Vite 6, React 19, TypeScript 5, Vitest, SheetJS (xlsx) для загрузки XLSX.

## Структура файлов
- `data/emiss.py`: клиент ЕМИСС (готов)
- `data/osm_x5.py`: магазины X5 из OSM (готов)
- `data/regions.csv`: справочник 85 субъектов (iso, okato, short, fd, tile_x, tile_y) (готов)
- `data/facts.json`: известные региональные объёмы из пресс-релизов (с цитатой и URL)
- `data/build.py`: сборка `public/data/regions.json`
- `data/test_build.py`: pytest
- `src/types.ts`: Region, Dataset, Strategy, AllocationRow
- `src/model/metrics.ts`: poor, priceIndex, modelAid, coverage, gapIndex
- `src/model/effect.ts`: liftedOut(poor, pop, kg)
- `src/model/allocate.ts`: allocate(regions, rub, strategy, params) -> AllocationRow[]
- `src/model/vat.ts`: vatScenario(regions, params, growth)
- `src/io/matchRegion.ts`: normalize + match(name|iso|okato)
- `src/io/parseUpload.ts`: CSV/XLSX -> {region, kg}[] + unmatched
- `src/io/exportCsv.ts`: строки -> CSV (BOM, «;»)
- `src/ui/*.tsx`: TileMap, Legend, RegionCard, Allocator, VatScenario, Upload, Method, App
- `src/styles.css`
- `.github/workflows/pages.yml`

## Задачи

### 1. Сборка данных
- [ ] `data/facts.json`: Корзина доброты 1 пол. 2025 (12 городов, кг), фудшеринг 1 пол. 2025 (5 городов, т), всё с URL и цитатой.
- [ ] `data/test_build.py` (сначала тесты): 85 регионов; у каждого tile уникален; poverty_rate 0–40; population > 10 000; сумма stores_est по сетям = официальным итогам ±1; price_index 0,6–3; ISO из regions.csv; Москва и Ингушетия присутствуют; факты ссылаются на существующие ISO.
- [ ] `data/build.py`: SDMX -> словари по ОКАТО; бедность 2025 (ряд 2021–2025); население 2024; набор 2025 (среднее 12 мес) и последний месяц; OSM -> масштаб по сетям; запись `public/data/regions.json`.
- [ ] `pytest data -q` зелёный, коммит.

### 2. Каркас фронтенда
- [ ] `npm create vite` (react-ts) в корне, зависимости: vitest, xlsx.
- [ ] `vite.config.ts`: `base: './'` (работает на Pages и локально), vitest jsdom не нужен (модель чистая).
- [ ] Коммит.

### 3. Модель (TDD, `src/model/*.test.ts`)
- [ ] metrics: poor = rate/100 × pop; priceIndex РФ = 1; modelAid сумма = V; coverage = aid/poor; gapIndex РФ-средний = 1.
- [ ] effect: 0 кг -> 0; монотонность; малые кг ≈ 0,2055 × rate × kg (отн. погрешность < 1e-3); не больше poor.
- [ ] allocate: для каждой стратегии Σ rub = S (±0,01); «как сейчас» ∝ stores; «по нужде» ∝ poor; «выровнять» поднимает минимальное покрытие и не даёт денег региону с покрытием выше итогового уровня; S = 0 -> пустые доли; регионы без данных исключены.
- [ ] vat: growth 0,4 -> доп. кг = 0,4 × V распределены как текущая помощь; эффект > 0.
- [ ] Коммит.

### 4. Ввод и вывод (TDD)
- [ ] matchRegion: все 85 официальных названий ЕМИСС; «г. Москва», «Москва», «RU-MOW», «45000000000», «Республика Татарстан», «Татарстан», «Кемеровская область — Кузбасс», «ХМАО», «Ханты-Мансийский автономный округ — Югра», «Чувашская Республика», «Северная Осетия — Алания», «Якутия», «Еврейская АО»; ё/е; регистр; мусор -> null.
- [ ] parseUpload: CSV «;» и «,», заголовки «регион/кг» (рус/англ), десятичная запятая, пробелы в числах, суммирование повторов, unmatched список; XLSX через SheetJS.
- [ ] exportCsv: BOM, «;», экранирование кавычек.
- [ ] Коммит.

### 5. Интерфейс
- [ ] TileMap (SVG, клавиатура, aria-label, подписи), Legend, LayerSwitch, RegionCard, Allocator (+CSV), VatScenario (+справка для GR, копирование), Upload (+шаблон, unmatched), Method; синхронизация с URL hash.
- [ ] Стиль: frontend-design; десктоп 1440 и телефон 390.
- [ ] Проверка глазами через gstack browse, исправления, коммит.

### 6. Деплой и документы
- [ ] `.github/workflows/pages.yml`: npm ci -> test -> build -> deploy-pages.
- [ ] README: что это, польза для фонда (по задачам), как пользоваться, данные и методика, ограничения, запуск локально, обновление данных, лицензии данных.
- [ ] Репозиторий на GitHub (нужен `gh auth login` от Дани), Pages, проверка живой ссылки.

## Самопроверка плана
Покрытие спеки: карта (5), распределение (3, 5), НДС (3, 5), загрузка (4, 5), методика (5, 6), данные (1), деплой (6). Пробелов нет.
