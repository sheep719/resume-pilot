"""PDF 解析缓存：内容哈希 → 结构化结果

同一份简历反复分析（换 JD 试）时跳过 LLM 解析调用——省钱省时。
缓存键：提取文本的 sha256（PDF 字节层差异不影响命中）。
上限 100 条，LRU 淘汰（内存缓存足够，无需持久化）。
"""
import hashlib
from collections import OrderedDict

_CACHE: OrderedDict[str, dict] = OrderedDict()
MAX_ENTRIES = 100


def _key(resume_text: str) -> str:
    return hashlib.sha256(resume_text.encode("utf-8")).hexdigest()


def get_cached_parse(resume_text: str) -> dict | None:
    key = _key(resume_text)
    hit = _CACHE.get(key)
    if hit is not None:
        _CACHE.move_to_end(key)  # LRU
    return hit


def put_cached_parse(resume_text: str, resume_dict: dict, warnings: list[str]) -> None:
    key = _key(resume_text)
    _CACHE[key] = {"resume": resume_dict, "warnings": warnings}
    _CACHE.move_to_end(key)
    while len(_CACHE) > MAX_ENTRIES:
        _CACHE.popitem(last=False)
