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
# Магазины X5 по федеральным округам на 31.12.2025, https://x5.ru/ru/about/where-we-operate/
# Доля региона считается по точкам OSM внутри своего округа и сети, поэтому неполнота OSM
# в Сибири и на Дальнем Востоке не переносит магазины в европейскую часть.
X5_BY_FD = {
    "ЦФО": {"pyaterochka": 8216, "perekrestok": 571, "chizhik": 1141},
    "ПФО": {"pyaterochka": 6006, "perekrestok": 125, "chizhik": 861},
    "СЗФО": {"pyaterochka": 2512, "perekrestok": 160, "chizhik": 11},
    "УФО": {"pyaterochka": 2284, "perekrestok": 68, "chizhik": 392},
    "ЮФО": {"pyaterochka": 3027, "perekrestok": 71, "chizhik": 535},
    "СФО": {"pyaterochka": 2351, "perekrestok": 0, "chizhik": 270},
    "СКФО": {"pyaterochka": 579, "perekrestok": 9, "chizhik": 43},
    "ДФО": {"pyaterochka": 558, "perekrestok": 0, "chizhik": 0},
}
X5_REGIONS_OFFICIAL = 75  # «75 регионов присутствия», там же
# Где X5 публиковала число магазинов по регионам округа, доля региона берётся оттуда, а не из OSM
# (на Дальнем Востоке OSM сильно отстаёт от открытий). Итог округа остаётся на 31.12.2025.
X5_FD_REGIONAL = {
    "ДФО": {
        "brand": "pyaterochka",
        "date": "09.2026",
        "sources": [
            "https://eastrussia.ru/material/tri-goda-na-dalnem-vostoke-kak-pyatyerochka-izmenila-produktovyy-riteyl-i-infrastrukturu-regiona/",
            "https://www.retail.ru/news/x5-vyydet-v-buryatiyu-i-na-kamchatskiy-kray-4-sentyabrya-2026-281748/",
        ],
        # «более 640 магазинов»: Хабаровский 197, Приморский «более 167», Забайкальский 150, Амурская 38, ЕАО 19;
        # Бурятия 57 (retail.ru); Якутия — остаток до 640.
        "stores": {"RU-KHA": 197, "RU-PRI": 167, "RU-ZAB": 150, "RU-AMU": 38, "RU-YEV": 19, "RU-BU": 57, "RU-SA": 12},
    },
}
# Регионы, куда X5 по своим новостям не выходила (переговоры и планы, без открытий):
# точки OSM с названиями сетей там — одноимённые местные магазины.
X5_ABSENT = {
    "RU-CHU": "переговоры об открытии в Анадыре, 09.2025",
    "RU-KAM": "соглашение о сотрудничестве на ВЭФ, 09.2026",
    "RU-MAG": "X5 «рассматривает» выход, 09.2024",
    "RU-SAK": "выход назван перспективой, 2023",
    "RU-NEN": "сведений о выходе нет",
}
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


def stores(fd_of: dict[str, str]) -> dict[str, dict[str, float]]:
    """Оценка магазинов X5 по регионам: доля точек OSM внутри федерального округа × официальный итог округа."""
    osm = json.loads((RAW / "osm_x5_by_region.json").read_text())["regions"]
    used = {iso: {b: (0 if iso in X5_ABSENT else c[b]) for b in X5_OFFICIAL} for iso, c in osm.items() if iso in fd_of}
    fd_osm: dict[str, dict[str, int]] = {}
    for iso, c in used.items():
        acc = fd_osm.setdefault(fd_of[iso], {b: 0 for b in X5_OFFICIAL})
        for b in X5_OFFICIAL:
            acc[b] += c[b]
    for fd, official in X5_BY_FD.items():
        for b, n in official.items():
            if n > 0 and fd_osm.get(fd, {}).get(b, 0) == 0:
                raise SystemExit(f"нет точек OSM для {b} в {fd}, а у X5 там {n} магазинов")
    est = {}
    for iso, c in osm.items():
        if iso not in fd_of:
            continue
        fd = fd_of[iso]
        est[iso] = {b: (used[iso][b] / fd_osm[fd][b] * X5_BY_FD[fd][b] if X5_BY_FD[fd][b] else 0.0) for b in X5_OFFICIAL}
        est[iso]["_osm"] = {b: c[b] for b in X5_OFFICIAL}
    for fd, spec in X5_FD_REGIONAL.items():
        b, known = spec["brand"], spec["stores"]
        total = sum(known.values())
        for iso in est:
            if fd_of[iso] == fd:
                est[iso][b] = known.get(iso, 0) / total * X5_BY_FD[fd][b]
    return est


def main() -> dict:
    pov, okato_names = poverty()
    pop = population()
    bsk, bsk_latest = basket()
    with open(HERE / "regions.csv", encoding="utf-8") as fh:
        fd_of = {row["iso"]: row["fd"] for row in csv.DictReader(fh)}
    st = stores(fd_of)
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
                **({"x5_absent": X5_ABSENT[row["iso"]]} if row["iso"] in X5_ABSENT else {}),
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
            "x5_stores_by_fd": X5_BY_FD,
            "x5_regions_official": X5_REGIONS_OFFICIAL,
            "x5_fd_regional": X5_FD_REGIONAL,
            "x5_absent": X5_ABSENT,
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
