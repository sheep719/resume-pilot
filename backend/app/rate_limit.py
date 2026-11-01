"""体验版限流：公网开放访问的必备防线（防止 LLM 额度被恶意刷光）

策略（双层）：
- 每 IP 每小时 10 次分析（正常用户改简历/换 JD 试 3-5 次足够）
- 全局每天 100 次（LLM 成本封顶约 ¥1/天，防薅羊毛）

实现：进程内内存计数器。单 worker uvicorn 部署下精确够用；
重启后清零（对防护场景无害——攻击者也要重新攒时间窗）。
"""
import time

HOURLY_PER_IP = 10
DAILY_GLOBAL = 100

_ip_hits: dict[str, list[float]] = {}
_global_hits: list[float] = []


def check(ip: str) -> str | None:
    """None = 放行；str = 拒绝原因（面向用户的中文提示）"""
    now = time.time()
    day_ago = now - 86400
    hour_ago = now - 3600

    _global_hits[:] = [t for t in _global_hits if t > day_ago]
    if len(_global_hits) >= DAILY_GLOBAL:
        return "今日体验名额已用完（每天 100 次，控制 LLM 成本）——欢迎明天再来"

    hits = [t for t in _ip_hits.get(ip, []) if t > hour_ago]
    _ip_hits[ip] = hits
    if len(hits) >= HOURLY_PER_IP:
        return "体验次数有点多啦（每小时限 10 次）——一小时后再试，或明天再来"

    return None


def record(ip: str) -> None:
    now = time.time()
    _ip_hits.setdefault(ip, []).append(now)
    _global_hits.append(now)


def remaining_today() -> int:
    now = time.time()
    _global_hits[:] = [t for t in _global_hits if t > now - 86400]
    return max(0, DAILY_GLOBAL - len(_global_hits))
