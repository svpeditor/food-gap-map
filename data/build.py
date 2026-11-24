"""Сборка public/data/regions.json из сохранённых ответов ЕМИСС, OSM и пресс-релизов.

Запуск: python data/build.py  (сеть не нужна: читает data/raw/*).
Обновить сырые данные: python data/emiss.py 62063 && python data/emiss.py 31556 2024 &&
python data/emiss.py 31481 2025,2026 && rm data/raw/osm_x5_shops.json && python data/osm_x5.py
"""
from __future__ import annotations

import csv
import json
import time
from pathlib import Path

import emiss

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = HERE.parent / "public" / "data" / "regions.json"

RU = "643004.АГ"  # «Российская Федерация без учета новых субъектов» — так Росстат публикует бедность
MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
FD = {
    "ЦФО": "Центральный", "СЗФО": "Северо-Западный", "ЮФО": "Южный", "СКФО": "Северо-Кавказский",
    "ПФО": "Приволжский", "УФО": "Уральский", "СФО": "Сибирский", "ДФО": "Дальневосточный",
}
X5_OFFICIAL = {"pyaterochka": 25533, "perekrestok": 1004, "chizhik": 3253}  # на 31.12.2025, см. facts.json quotes.x5_stores
PARAMS = {
    "msu_coef": 0.2055,          # −20,55 % бедности на +1 кг/душу/год (фонд «Выручаем» и МГУ, 2026)
    "vat_growth_min": 0.40,      # «как минимум на 40%» при освобождении от НДС
    "vat_cost_per_100": [8, 16], # ₽ альтернативных издержек на 100 ₽ переданной продукции
    "baseline_tonnes": 1100,     # «Пятёрочка», 2024: «свыше 1,1 тыс. тонн»
    "price_per_kg": 231,         # «Перекрёсток», 1 пол. 2026: 52 т ≈ 12 млн ₽ -> ≈231 ₽/кг
}


def sdmx(ind: int) -> tuple[list[dict], dict]:
    return emiss.parse_sdmx((RAW / f"emiss_{ind}.xml").read_bytes())


def poverty() -> tuple[dict[str, dict[str, float]], dict[str, str]]:
    rows, names = sdmx(62063)
    out: dict[str, dict[str, float]] = {}
    for r in rows:
        if r["value"] is not None:
            out.setdefault(r["s_OKATO"], {})[r["period_year"]] = r["value"]
    return out, names["s_OKATO"]


def population() -> dict[str, float]:
    rows, _ = sdmx(31556)
    return {r["s_OKATO"]: r["value"] for r in rows if r.get("s_kategnasel") == "4" and r["period_year"] == "2024"}


def basket() -> tuple[dict[str, float], dict[str, dict]]:
    rows, _ = sdmx(31481)
    by: dict[str, dict[tuple[int, int], float]] = {}
    for r in rows:
        if r["value"] is not None and r.get("PERIOD") in MONTHS:
            by.setdefault(r["s_OKATO"], {})[(int(r["period_year"]), MONTHS.index(r["PERIOD"]))] = r["value"]
    avg2025 = {k: sum(v for (y, _), v in s.items() if y == 2025) / sum(1 for (y, _) in s if y == 2025) for k, s in by.items() if any(y == 2025 for y, _ in s)}
    latest = {}
    for k, s in by.items():
        y, m = max(s)
        latest[k] = {"value": s[(y, m)], "month": f"{MONTHS[m]} {y}"}
    return avg2025, latest


def stores() -> dict[str, dict[str, float]]:
    osm = json.loads((RAW / "osm_x5_by_region.json").read_text())["regions"]
    totals = {b: sum(c[b] for c in osm.values()) for b in X5_OFFICIAL}
    est = {}
    for iso, c in osm.items():
        est[iso] = {b: c[b] / totals[b] * X5_OFFICIAL[b] for b in X5_OFFICIAL}
        est[iso]["_osm"] = {b: c[b] for b in X5_OFFICIAL}
    return est


def main() -> dict:
    pov, okato_names = poverty()
    pop = population()
    bsk, bsk_latest = basket()
    st = stores()
    facts = json.loads((HERE / "facts.json").read_text())
    zero = {b: 0.0 for b in X5_OFFICIAL}

    regions = []
    with open(HERE / "regions.csv", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            ok = row["okato"]
            series = pov[ok]
            rate = series["2025"]
            p = pop[ok]
            s = st.get(row["iso"], {**zero, "_osm": {b: 0 for b in X5_OFFICIAL}})
            by_brand = {b: s[b] for b in X5_OFFICIAL}
            regions.append({
                "iso": row["iso"],
                "okato": ok,
                "name": okato_names[ok],
                "short": row["short"],
                "fd": FD[row["fd"]],
                "tile": [int(row["tile_x"]), int(row["tile_y"])],
                "population": p,
                "poverty_rate": rate,
                "poverty_series": series,
                "poor": rate / 100 * p,
                "basket": round(bsk[ok], 2),
                "basket_latest": bsk_latest[ok],
                "price_index": bsk[ok] / bsk[RU],
                "stores_by_brand": by_brand,
                "stores_osm": s["_osm"],
                "stores_est": sum(by_brand.values()),
                "facts": [
                    {**f, **{k: facts["programs"][f["program"]][k] for k in ("program", "kind", "period", "url")}}
                    for f in facts["facts"] if f["iso"] == row["iso"]
                ],
            })

    osm_meta = json.loads((RAW / "osm_x5_by_region.json").read_text())
    ds = {
        "meta": {
            "built_at": time.strftime("%Y-%m-%d"),
            "params": PARAMS,
            "x5_stores_official": X5_OFFICIAL,
            "osm": {"fetched_at": osm_meta["fetched_at"], "total_shops": osm_meta["total_shops"], "unmatched": osm_meta["unmatched"]},
            "years": {"poverty": "2025", "population": "2024 (среднегодовая)", "basket": "2025 (среднее за 12 месяцев)"},
            "quotes": facts["quotes"],
            "programs": facts["programs"],
        },
        "russia": {
            "poverty_rate": pov[RU]["2025"],
            "poverty_series": pov[RU],
            "population": pop[RU],
            "basket": round(bsk[RU], 2),
            "basket_latest": bsk_latest[RU],
            "name": okato_names[RU],
        },
        "regions": regions,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ds, ensure_ascii=False, separators=(",", ":")))
    return ds


if __name__ == "__main__":
    d = main()
    print(len(d["regions"]), "regions ->", OUT, OUT.stat().st_size, "bytes")
