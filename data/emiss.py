"""Минимальный клиент ЕМИСС (fedstat.ru) — официальной витрины данных Росстата.

Запрос идёт напрямую (без прокси): сайт отвечает только российским IP.
fetch(indicator_id) -> список словарей {dim...: value, 'period': ..., 'value': float}.
Исходный ответ SDMX сохраняется в data/raw/emiss_<id>.xml для воспроизводимости.
"""
from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import certifi
import http.cookiejar

RAW = Path(__file__).resolve().parent / "raw"
CA_RU = RAW / "ru_ca_bundle.pem"  # Russian Trusted Root/Sub CA (gu-st.ru), нужен для fedstat.ru
BASE = "https://www.fedstat.ru"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def _opener() -> urllib.request.OpenerDirector:
    ctx = ssl.create_default_context(cafile=certifi.where())
    if CA_RU.exists():
        ctx.load_verify_locations(cafile=str(CA_RU))
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        urllib.request.HTTPSHandler(context=ctx),
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
    )


_OP = _opener()


def _get(url: str, data: bytes | None = None) -> bytes:
    headers = {"User-Agent": UA, "Accept-Language": "ru-RU,ru;q=0.9"}
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, headers=headers)
    for attempt in range(5):
        try:
            with _OP.open(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:  # ЕМИСС отвечает 503 при частых запросах
            if e.code != 503 or attempt == 4:
                raise
            time.sleep(30 * (attempt + 1))
    raise RuntimeError("unreachable")


def _js_block(src: str, key: str) -> str:
    """Возвращает текст JS-литерала после `key:` (объект или массив) по балансу скобок."""
    i = src.index(key + ":")
    j = i + len(key) + 1
    while src[j] not in "[{":
        j += 1
    open_ch = src[j]
    close_ch = "]" if open_ch == "[" else "}"
    depth = 0
    for k in range(j, len(src)):
        if src[k] == open_ch:
            depth += 1
        elif src[k] == close_ch:
            depth -= 1
            if depth == 0:
                return src[j : k + 1]
    raise ValueError("unbalanced " + key)


def _js_to_json(s: str) -> object:
    s = re.sub(r"'((?:[^'\\]|\\.)*)'", lambda m: '"' + m.group(1).replace('"', '\\"') + '"', s)
    s = re.sub(r"([{,]\s*)([A-Za-z_0-9]+)\s*:", r'\1"\2":', s)
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return json.loads(s)


def grid_config(indicator_id: int) -> dict:
    html = _get(f"{BASE}/indicator/{indicator_id}").decode("utf-8")
    script = html[html.index("new FGrid(") :]
    holder = html[html.index('id="downloadTokenHolder"') :]
    holder = holder[: holder.index("</div>")]
    inputs = dict(re.findall(r'name="([^"]+)"[^>]*value="([^"]*)"', holder))
    token_name = inputs["struts.token.name"]
    return {
        "token_name": token_name,
        "token": inputs[token_name],
        "title": _js_to_json("[" + re.search(r"title: ('(?:[^'\\]|\\.)*')", script).group(1) + "]")[0],
        "filters": _js_to_json(_js_block(script, "filters")),
        "left": _js_to_json(_js_block(script, "left_columns")),
        "top": _js_to_json(_js_block(script, "top_columns")),
    }


def fetch(indicator_id: int, years: set[str] | None = None) -> tuple[dict, list[dict]]:
    cfg = grid_config(indicator_id)
    if years:  # фильтр «Год» (id 3) — чтобы не тянуть 25 лет помесячных рядов
        cfg["filters"]["3"]["values"] = {k: v for k, v in cfg["filters"]["3"]["values"].items() if k in years}
    form: list[tuple[str, str]] = [
        ("title", cfg["title"]),
        ("struts.token.name", cfg["token_name"]),
        (cfg["token_name"], cfg["token"]),
        ("id", str(indicator_id)),
    ]
    for fid in cfg["filters"]:
        layout = "lineObjectIds" if int(fid) in cfg["left"] else "columnObjectIds" if int(fid) in cfg["top"] else "filterObjectIds"
        form.append((layout, str(fid)))
    for fid, f in cfg["filters"].items():
        for vid in f["values"]:
            form.append(("selectedFilterIds", f"{fid}_{vid}"))
    xml = _get(f"{BASE}/indicator/downloadData.do?format=sdmx", urllib.parse.urlencode(form).encode())
    RAW.mkdir(exist_ok=True)
    (RAW / f"emiss_{indicator_id}.xml").write_bytes(xml)
    return cfg, parse_sdmx(xml)


def parse_sdmx(xml: bytes) -> list[dict]:
    root = ET.fromstring(xml)
    ns = {"g": "http://www.SDMX.org/resources/SDMXML/schemas/v1_0/generic"}
    names: dict[str, dict[str, str]] = {}
    for cl in root.iter():
        if cl.tag.endswith("CodeList"):
            cid = cl.get("id")
            codes = {}
            for code in cl:
                if code.tag.endswith("Code"):
                    desc = next((d.text for d in code if d.tag.endswith("Description")), None)
                    codes[code.get("value")] = (desc or "").strip()
            names[cid] = codes
    rows = []
    for series in root.iter("{%s}Series" % ns["g"]):
        key = {}
        for v in series.find("g:SeriesKey", ns):
            key[v.get("concept")] = v.get("value")
        attrs = series.find("g:Attributes", ns)
        for v in attrs if attrs is not None else []:
            key[v.get("concept")] = v.get("value")
        for obs in series.findall("g:Obs", ns):
            t_el = obs.find("g:Time", ns)
            t = t_el.text if t_el is not None else None
            val = obs.find("g:ObsValue", ns).get("value")
            row = dict(key)
            row["period_year"] = t
            row["value"] = float(val.replace(",", ".")) if val not in (None, "") else None
            rows.append(row)
    return rows, names


if __name__ == "__main__":
    ind = int(sys.argv[1])
    cfg, (rows, names) = fetch(ind, set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None)
    print(cfg["title"], len(rows))
    for r in rows[:5]:
        print(r)
    print({k: list(v.items())[:3] for k, v in names.items()})
