"""解析缓存测试"""
from app.parse_cache import get_cached_parse, put_cached_parse


def test_cache_hit_and_lru():
    text_a, text_b = "简历内容A" * 10, "简历内容B" * 10

    assert get_cached_parse(text_a) is None  # 未命中

    put_cached_parse(text_a, {"skills": ["A"]}, ["w1"])
    hit = get_cached_parse(text_a)
    assert hit is not None and hit["resume"]["skills"] == ["A"]
    assert hit["warnings"] == ["w1"]

    put_cached_parse(text_b, {"skills": ["B"]}, [])
    assert get_cached_parse(text_b)["resume"]["skills"] == ["B"]
    assert get_cached_parse("不存在的简历") is None


def test_cache_capacity_lru_eviction():
    from app.parse_cache import MAX_ENTRIES
    for i in range(MAX_ENTRIES + 5):
        put_cached_parse(f"简历-{i}", {"i": i}, [])
    # 最早的 5 条被 LRU 淘汰
    assert get_cached_parse("简历-0") is None
    assert get_cached_parse(f"简历-{MAX_ENTRIES + 4}") is not None
    # 刚访问过的会续命
    put_cached_parse("简历-newest", {"x": 1}, [])
    assert get_cached_parse(f"简历-{MAX_ENTRIES + 4}") is not None
