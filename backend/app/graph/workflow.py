"""LangGraph 编排：三节点线性图 + 条件边

条件边（设计要点）：Agent 2 判定总分 > 85 时跳过 Agent 3（已经很好，只给微调建议），
避免无效 LLM 调用。

为什么用 StateGraph 而不是顺序调用：
- 状态传递：节点间通过共享 State 读写，无需层层传参
- 条件分支：路由函数声明式表达跳过逻辑
- 可观测性：每个节点的耗时/执行路径落入 trace
- 扩展性：未来加 Agent（如"排版检查"）只需 add_node + 接边，不改主干

埋点分工：流式端点（/api/analyze/stream）在 main.py 预跑 parser/matcher（带埋点），
图内这两个节点命中幂等跳过分支，不重复埋点；非流式端点（/api/analyze）直接进图，
节点经 RunnableConfig 拿 langfuse_trace 自己埋 generation（token 用量一并上报）。
"""
import time
from typing import TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph

from app import observability
from app.agents.matcher_agent import match_jd
from app.agents.parser_agent import parse_resume
from app.agents.rewriter_agent import rewrite
from app.llm import is_stub
from app.schemas import SKIP_REWRITE_THRESHOLD


class PipelineState(TypedDict, total=False):
    resume_text: str
    jd_text: str
    resume: dict
    match: dict
    rewrites: list
    trace: list


def _trace(state: PipelineState, node: str, ms: float) -> list:
    return state.get("trace", []) + [
        {"node": node, "ms": round(ms), "stub": is_stub()}
    ]


def _lf_trace(config: RunnableConfig):
    """从 RunnableConfig 拿 Langfuse trace root（未传则 None，埋点自动关闭）"""
    if not config:
        return None
    return (config.get("configurable") or {}).get("langfuse_trace")


def _model_name() -> str:
    from app.config import settings
    return settings.model


async def parser_node(state: PipelineState, config: RunnableConfig) -> dict:
    if state.get("resume"):  # 幂等跳过：流式端点已预跑 Agent 1
        return {"trace": state.get("trace", []) + [{"node": "parser", "ms": 0, "skipped_precomputed": True}]}
    t0 = time.perf_counter()
    usage_out: list = []
    with observability.observe_generation(
        _lf_trace(config), "parser", "parser-v2", _model_name(), usage_out=usage_out
    ):
        resume = await parse_resume(state["resume_text"], usage_out=usage_out)
    return {"resume": resume, "trace": _trace(state, "parser", (time.perf_counter() - t0) * 1000)}


async def matcher_node(state: PipelineState, config: RunnableConfig) -> dict:
    if state.get("match"):  # 幂等跳过：流式端点已预跑 Agent 2
        return {"trace": state.get("trace", []) + [{"node": "matcher", "ms": 0, "skipped_precomputed": True}]}
    t0 = time.perf_counter()
    usage_out: list = []
    with observability.observe_generation(
        _lf_trace(config), "matcher", "matcher-v2", _model_name(), usage_out=usage_out
    ):
        match = await match_jd(state["resume"], state["jd_text"], usage_out=usage_out)
    return {"match": match, "trace": _trace(state, "matcher", (time.perf_counter() - t0) * 1000)}


async def rewriter_node(state: PipelineState, config: RunnableConfig) -> dict:
    t0 = time.perf_counter()
    # config 携带 SSE queue（侧信道）+ langfuse_trace，rewriter 内部逐条推送/埋点
    rewrites = await rewrite(state["resume"], state["match"]["requirements"], config=config)
    return {"rewrites": rewrites, "trace": _trace(state, "rewriter", (time.perf_counter() - t0) * 1000)}


def route_after_match(state: PipelineState) -> str:
    """条件边路由：总分 > 85 直接结束，跳过改写器"""
    score = (state.get("match") or {}).get("total_score", 0)
    return "end" if score > SKIP_REWRITE_THRESHOLD else "rewriter"


def build_graph():
    g = StateGraph(PipelineState)
    g.add_node("parser", parser_node)
    g.add_node("matcher", matcher_node)
    g.add_node("rewriter", rewriter_node)

    g.add_edge(START, "parser")
    g.add_edge("parser", "matcher")
    g.add_conditional_edges(
        "matcher",
        route_after_match,
        {"rewriter": "rewriter", "end": END},  # score > 85 → 跳过改写
    )
    g.add_edge("rewriter", END)
    return g.compile()
