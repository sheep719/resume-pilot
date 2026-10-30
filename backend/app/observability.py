"""Langfuse 全链路可观测层（v5 SDK）

设计：
- 一次分析请求 = 1 条 trace（root chain observation）+ 每个 Agent 节点 1 个 generation
- trace 的 name/session 挂在 root observation 的 OTel attribute 上（v5 语义）
- LANGFUSE_PUBLIC_KEY 未配置时 observability 关闭（零开销直通）——本地骨架无负担
"""
import json
import logging
import os
import time
from contextlib import contextmanager

logger = logging.getLogger(__name__)

_client = None
_initialized = False


def _ensure_no_proxy(host: str) -> None:
    """本机 Langfuse 上报强制绕过系统代理。

    背景：OTLP 导出走 requests.Session()（trust_env 默认开），会读取
    HTTP_PROXY/HTTPS_PROXY 环境变量；代理（clash/沙箱代理）会间歇性吞掉
    发往 localhost:3001 的导出请求，BatchSpanProcessor 导出失败后静默丢弃
    span（不重试）——症状是"随机丢整条 trace"。设 NO_PROXY 是标准解法。
    """
    from urllib.parse import urlparse
    hostname = (urlparse(host).hostname or "localhost").lower()
    no_proxy = (os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or "")
    entries = {h.strip().lower() for h in no_proxy.split(",") if h.strip()}
    entries.update({"localhost", "127.0.0.1", "::1", hostname})
    joined = ",".join(sorted(entries))
    os.environ["NO_PROXY"] = joined
    os.environ["no_proxy"] = joined  # requests/httpx 大小写两个变量都认


def _get_client():
    global _client, _initialized
    if _initialized:
        return _client
    _initialized = True
    if not (os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY")):
        return None
    try:
        from langfuse import Langfuse
        host = os.getenv("LANGFUSE_HOST", "http://localhost:3001")
        _ensure_no_proxy(host)
        # environment 标签（default/e2e/production…）：Langfuse UI 可按环境筛选，
        # E2E 回归不再混进真实使用数据（run_e2e.py 会设 LANGFUSE_TRACING_ENVIRONMENT=e2e）
        env = {"environment": os.getenv("LANGFUSE_TRACING_ENVIRONMENT") or None}
        _client = Langfuse(host=host, **{k: v for k, v in env.items() if v})
    except Exception as exc:
        logger.warning("Langfuse 初始化失败（可观测性关闭）: %s", exc)
    return _client


def enabled() -> bool:
    return _get_client() is not None


def warmup():
    """服务启动时预初始化 client + OTel provider，消除首个请求的导出竞态"""
    client = _get_client()
    if not client:
        return
    try:
        # 起一条最小 trace 并立即结束，确保 span processor/exporter 全链路就绪
        # level=DEBUG：预热探针不打乱 Langfuse 默认视图（DEBUG 级默认被过滤）
        probe = client.start_observation(name="warmup", as_type="span", level="DEBUG")
        probe.end()
        client.flush()
        logger.info("Langfuse 预热完成（trace 上报通道就绪）")
    except Exception as exc:
        logger.warning("Langfuse 预热失败（可观测性可能降级）: %s", exc)


def start_trace(session_id: str, jd_digest: str, tags: list[str] | None = None):
    """一次分析请求的 trace root（chain observation）。

    v5：name 在 start_observation 上直接给；session/tags 通过 root span 的
    OTel attribute（session.id / langfuse.trace.tags）设置。
    """
    client = _get_client()
    if not client:
        return None
    try:
        root = client.start_observation(
            name="resume-analysis",
            as_type="chain",
            metadata={"jd_digest": jd_digest[:80]},
        )
        # trace 级属性挂在 root observation 上（v5 语义）
        root._otel_span.set_attribute("langfuse.trace.name", "resume-analysis")
        root._otel_span.set_attribute("session.id", session_id)
        if tags:
            root._otel_span.set_attribute("langfuse.trace.tags", json.dumps(tags))
        return root
    except Exception as exc:
        logger.warning("Langfuse start_trace 失败（本次请求不上报）: %s", exc)
        return None


@contextmanager
def observe_generation(trace, name: str, prompt_version: str, model: str,
                       metadata: dict | None = None, usage_out: list | None = None):
    """一个 Agent 节点的 generation 埋点：with 块内的执行自动计时/记录。

    usage_out：传入与 chat(usage_out=...) 共享的列表，块结束时汇总
    LLM token 用量写入 generation 的 usage_details（Langfuse 据此算成本）。
    """
    client = _get_client()
    t0 = time.perf_counter()
    gen = None
    if client and trace:
        try:
            gen = trace.start_observation(
                name=name,
                as_type="generation",
                model=model,
                metadata={"prompt_version": prompt_version, **(metadata or {})},
            )
        except Exception as exc:
            logger.warning("Langfuse generation 埋点失败（%s）: %s", name, exc)
    try:
        yield gen
    except Exception as exc:
        if gen:
            try:
                gen.update(output={"error": str(exc)[:300]}, level="ERROR")
            except Exception:
                pass
        raise
    finally:
        if gen:
            try:
                if usage_out:
                    # token 用量汇总（重试/多轮调用累加），Langfuse 据此计算成本
                    gen.update(usage_details={
                        "input": sum(u.get("input", 0) for u in usage_out),
                        "output": sum(u.get("output", 0) for u in usage_out),
                        "total": sum(u.get("total", 0) for u in usage_out),
                    })
                gen.end()
            except Exception:
                pass


def end_trace(trace, output: dict | None = None):
    """结束 trace root（成功路径）"""
    if trace:
        try:
            if output is not None:
                trace.update(output=output)
            trace.end()
        except Exception as exc:
            logger.warning("Langfuse end_trace 失败: %s", exc)


def flush():
    if _client:
        try:
            _client.flush()
        except Exception:
            pass
