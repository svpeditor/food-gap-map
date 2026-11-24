import json
from pathlib import Path

import pytest

import build

OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "regions.json"


@pytest.fixture(scope="module")
def ds():
    build.main()
    return json.loads(OUT.read_text())


def test_85_regions_unique_tiles(ds):
    regs = ds["regions"]
    assert len(regs) == 85
    assert len({tuple(r["tile"]) for r in regs}) == 85
    assert len({r["iso"] for r in regs}) == 85


def test_key_regions_present(ds):
    isos = {r["iso"] for r in ds["regions"]}
    assert {"RU-MOW", "RU-IN", "RU-CHU", "RU-KGD", "RU-NEN", "RU-TYU"} <= isos


def test_values_in_sane_ranges(ds):
    for r in ds["regions"]:
        assert 0 < r["poverty_rate"] < 40, r["iso"]
        assert r["population"] > 10_000, r["iso"]
        assert 0.6 < r["price_index"] < 3, r["iso"]
        assert r["poor"] == pytest.approx(r["poverty_rate"] / 100 * r["population"], rel=1e-6)
        assert set(r["poverty_series"]) >= {"2024", "2025"}


def test_stores_scaled_to_official_totals(ds):
    official = ds["meta"]["x5_stores_official"]
    for brand in ("pyaterochka", "perekrestok", "chizhik"):
        total = sum(r["stores_by_brand"][brand] for r in ds["regions"])
        assert total == pytest.approx(official[brand], abs=1.0), brand
    for r in ds["regions"]:
        assert r["stores_est"] == pytest.approx(sum(r["stores_by_brand"].values()), abs=1e-6)


def test_stores_match_official_federal_districts(ds):
    by_fd = ds["meta"]["x5_stores_by_fd"]
    fd_code = {v: k for k, v in build.FD.items()}
    for fd, official in by_fd.items():
        for brand, n in official.items():
            total = sum(r["stores_by_brand"][brand] for r in ds["regions"] if fd_code[r["fd"]] == fd)
            assert total == pytest.approx(n, abs=1.0), (fd, brand)


def test_x5_presence_matches_official_region_count(ds):
    for r in ds["regions"]:
        if r["iso"] in ds["meta"]["x5_absent"]:
            assert r["stores_est"] == 0, r["iso"]
    present = sum(1 for r in ds["regions"] if r["stores_est"] > 0.5)
    # X5: 75 регионов присутствия; лишний у нас — Дагестан, где в OSM есть точки «Пятёрочки»
    assert abs(present - ds["meta"]["x5_regions_official"]) <= 1


def test_far_east_uses_published_regional_counts(ds):
    spec = ds["meta"]["x5_fd_regional"]["ДФО"]
    known = spec["stores"]
    by = {r["iso"]: r["stores_by_brand"]["pyaterochka"] for r in ds["regions"]}
    assert by["RU-KHA"] / by["RU-BU"] == pytest.approx(known["RU-KHA"] / known["RU-BU"], rel=1e-9)
    assert by["RU-KAM"] == 0 and by["RU-CHU"] == 0


def test_russia_totals(ds):
    ru = ds["russia"]
    assert 5 < ru["poverty_rate"] < 12
    assert ru["population"] > 140_000_000
    assert ru["basket"] > 5000
    poor_sum = sum(r["poor"] for r in ds["regions"])
    # сумма по 85 субъектам близка к оценке РФ (ставка РФ × население РФ без новых субъектов)
    assert poor_sum == pytest.approx(ru["poverty_rate"] / 100 * ru["population"], rel=0.05)


def test_facts_reference_known_regions(ds):
    isos = {r["iso"] for r in ds["regions"]}
    for r in ds["regions"]:
        for f in r["facts"]:
            assert f["kg"] > 0 and f["url"].startswith("https://")
    assert sum(len(r["facts"]) for r in ds["regions"]) == 17
    assert all(r["iso"] in isos for r in ds["regions"])
