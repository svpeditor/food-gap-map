"""Магазины сетей X5 («Пятёрочка», «Перекрёсток», «Чижик») по субъектам РФ по данным OpenStreetMap.

1. Один запрос Overpass на всю Россию: все shop=* с именем/брендом сетей X5, координаты (center).
2. Раскладка точек по границам субъектов geoBoundaries RUS ADM1 (ODbL, производная OSM).
OSM — открытая карта, покрытие неполное: в проекте используется ДОЛЯ региона в магазинах X5,
а абсолютное число масштабируется на официальный итог X5 (см. build.py).
Результат: data/raw/osm_x5_shops.json (точки) и data/raw/osm_x5_by_region.json (счёт по регионам).
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parent / "raw"
ENDPOINTS = [
    ("https://maps.mail.ru/osm/tools/overpass/api/interpreter", False),  # российское зеркало, напрямую
    ("https://overpass-api.de/api/interpreter", True),  # основной сервер, через системный прокси
    ("https://overpass.private.coffee/api/interpreter", True),
    ("https://overpass.kumi.systems/api/interpreter", True),
]
BOUNDARIES_URL = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/RUS/ADM1/geoBoundaries-RUS-ADM1_simplified.geojson"
BRANDS = {
    "pyaterochka": re.compile(r"^Пят[её]рочка", re.I),
    "perekrestok": re.compile(r"^Перекр[её]сток", re.I),
    "chizhik": re.compile(r"^Чижик", re.I),
}
# С 3 кв. 2025 X5 учитывает сибирские сети «Красный Яр» и «Слата» в составе «Пятёрочки»
# (x5.ru/ru/about/where-we-operate), поэтому их точки считаются отдельным запросом и идут в «Пятёрочку».
ACQUIRED = {"Красный Яр": "krasny_yar", "Слата": "slata"}
QUERY_ACQUIRED = """[out:json][timeout:600];
(
  nwr["name"="Красный Яр"]["shop"~"^(supermarket|convenience|grocery|food)$"];
  nwr["brand"="Красный Яр"]["shop"];
  nwr["name"="Слата"]["shop"~"^(supermarket|convenience|grocery|food)$"];
  nwr["brand"="Слата"]["shop"];
);
out center tags;"""
QUERY = """[out:json][timeout:900];
(
  nwr["name"="Пятёрочка"]["shop"];
  nwr["brand"="Пятёрочка"]["shop"];
  nwr["name"="Пятерочка"]["shop"];
  nwr["brand"="Пятерочка"]["shop"];
  nwr["name"="Перекрёсток"]["shop"];
  nwr["brand"="Перекрёсток"]["shop"];
  nwr["name"="Перекресток"]["shop"];
  nwr["brand"="Перекресток"]["shop"];
  nwr["name"="Чижик"]["shop"];
  nwr["brand"="Чижик"]["shop"];
);
out center tags;"""


def overpass(query: str, rounds: int = 3) -> list[dict]:
    for attempt in range(rounds):
        for url, use_proxy in ENDPOINTS:
            op = urllib.request.build_opener(*([] if use_proxy else [urllib.request.ProxyHandler({})]))
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": "food-gap-map/0.1 (open data research)"})
            t0 = time.time()
            try:
                with op.open(req, timeout=1200) as r:
                    els = json.loads(r.read())["elements"]
            except Exception as e:  # noqa: BLE001
                print(url, "failed:", repr(e)[:200], file=sys.stderr)
                continue
            print(url, len(els), "elements,", round(time.time() - t0), "s", file=sys.stderr)
            return els
        time.sleep(30 * (attempt + 1))
    raise SystemExit("overpass: all endpoints failed")


def fetch_acquired() -> list[dict]:
    path = RAW / "osm_x5_acquired.json"
    if path.exists():
        return json.loads(path.read_text())["shops"]
    shops = []
    for e in overpass(QUERY_ACQUIRED):
        tags = e.get("tags", {})
        chain = ACQUIRED.get(tags.get("brand") or "") or ACQUIRED.get(tags.get("name") or "")
        lat = e.get("lat", e.get("center", {}).get("lat"))
        lon = e.get("lon", e.get("center", {}).get("lon"))
        if chain and lat is not None:
            shops.append({"id": f"{e['type'][0]}{e['id']}", "brand": "pyaterochka", "chain": chain, "lat": round(lat, 5), "lon": round(lon, 5)})
    path.write_text(json.dumps({"source": "OpenStreetMap via Overpass API (ODbL)", "fetched_at": time.strftime("%Y-%m-%d"), "query": QUERY_ACQUIRED, "shops": shops}, ensure_ascii=False))
    return shops


def fetch_shops() -> list[dict]:
    path = RAW / "osm_x5_shops.json"
    if path.exists():
        return json.loads(path.read_text())["shops"]
    els = overpass(QUERY)
    shops = []
    for e in els:
        tags = e.get("tags", {})
        label = tags.get("brand") or tags.get("name") or ""
        brand = next((b for b, rx in BRANDS.items() if rx.match(label) or rx.match(tags.get("name", ""))), None)
        lat = e.get("lat", e.get("center", {}).get("lat"))
        lon = e.get("lon", e.get("center", {}).get("lon"))
        if brand and lat is not None:
            shops.append({"id": f"{e['type'][0]}{e['id']}", "brand": brand, "lat": round(lat, 5), "lon": round(lon, 5)})
    path.write_text(json.dumps({"source": "OpenStreetMap via Overpass API (ODbL)", "fetched_at": time.strftime("%Y-%m-%d"), "query": QUERY, "shops": shops}, ensure_ascii=False))
    return shops


def fetch_boundaries() -> dict:
    path = RAW / "geoboundaries_rus_adm1_simplified.geojson"
    if not path.exists():
        with urllib.request.urlopen(BOUNDARIES_URL, timeout=300) as r:
            path.write_bytes(r.read())
    return json.loads(path.read_text())


def _rings(geom: dict) -> list[list[list[list[float]]]]:
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


def _in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-300) + xi:
            inside = not inside
        j = i
    return inside


def locate(shops: list[dict], fc: dict) -> dict[str, dict]:
    regions = []
    for f in fc["features"]:
        polys = _rings(f["geometry"])
        xs = [p[0] for poly in polys for p in poly[0]]
        ys = [p[1] for poly in polys for p in poly[0]]
        regions.append((f["properties"].get("shapeISO"), f["properties"].get("shapeName"), polys, (min(xs), min(ys), max(xs), max(ys))))
    counts: dict[str, dict] = {iso: {"name": name, "pyaterochka": 0, "perekrestok": 0, "chizhik": 0} for iso, name, _, _ in regions}
    unmatched = 0
    for s in shops:
        x, y = s["lon"], s["lat"]
        hit = None
        for iso, _, polys, (x0, y0, x1, y1) in regions:
            if not (x0 <= x <= x1 and y0 <= y <= y1):
                continue
            for poly in polys:
                if _in_ring(x, y, poly[0]) and not any(_in_ring(x, y, hole) for hole in poly[1:]):
                    hit = iso
                    break
            if hit:
                break
        if hit:
            counts[hit][s["brand"]] += 1
        else:
            unmatched += 1
    print("unmatched shops (outside boundaries / border noise):", unmatched, file=sys.stderr)
    return counts, unmatched


if __name__ == "__main__":
    shops = fetch_shops() + fetch_acquired()
    fc = fetch_boundaries()
    counts, unmatched = locate(shops, fc)
    out = {
        "source": "OpenStreetMap (ODbL) via Overpass API; boundaries: geoBoundaries RUS ADM1 (ODbL)",
        "fetched_at": json.loads((RAW / "osm_x5_shops.json").read_text())["fetched_at"],
        "total_shops": len(shops),
        "unmatched": unmatched,
        "regions": counts,
    }
    (RAW / "osm_x5_by_region.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    tot = {b: sum(c[b] for c in counts.values()) for b in BRANDS}
    print(len(shops), "shops;", tot)
