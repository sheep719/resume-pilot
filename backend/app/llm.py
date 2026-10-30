"""LLM 调用封装（DeepSeek，OpenAI 兼容协议）

DEEPSEEK_API_KEY 未配置时进入 stub 模式（is_stub() == True），
各 Agent 直接返回固定假数据，保证骨架在无 key、无网络下可完整跑通流水线。
后续逐步把 stub 替换为真实调用。

工程细节：
- timeout + 有限重试：DeepSeek 偶发挂起不设超时会拖死 SSE 流（SDK 默认 600s 太长）
- usage 采集：token 用量通过 usage_out 收集器透传给 Langfuse（成本看板的原始数据）
"""
import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

LLM_TIMEOUT_S = 60          # 单次调用上限：JSON 结构化输出 95 分位 < 15s，60s 足够宽
LLM_MAX_ATTEMPTS = 2        # 挂起/网络抖动重试 1 次（校验重试由 chat_json 层负责）


def is_stub() -> bool:
    return not settings.api_key


_client_cache: Any = None  # AsyncOpenAI 单例：底层 httpx 连接池复用（TCP keep-alive）


def _client():
    from openai import AsyncOpenAI  # 延迟导入，stub 模式不强依赖 openai 包

    global _client_cache
    if _client_cache is None:
        _client_cache = AsyncOpenAI(api_key=settings.api_key, base_url=settings.base_url)
    return _client_cache


async def chat(
    messages: list[dict[str, str]],
    json_mode: bool = False,
    usage_out: list | None = None,
) -> str:
    """调用 LLM，返回文本内容。

    - json_mode=True 时要求模型输出合法 JSON
    - usage_out 传入列表时，token 用量 dict 会 append 进去（Langfuse 埋点用）
    - 超时/瞬时失败重试 1 次（指数退避由 SDK 内部 APITimeoutError 语义决定，这里简单立即重试）
    """
    if is_stub():
        raise RuntimeError("stub 模式下不应调用 chat()——Agent 应先判断 is_stub()")

    last_err: Exception | None = None
    for attempt in range(LLM_MAX_ATTEMPTS):
        try:
            resp = await _client().chat.completions.create(
                model=settings.model,
                messages=messages,
                temperature=0.0,  # 评分/解析类任务要确定性输出（默认 temperature 下同输入总分漂移实测 4.0，置 0 后收敛到 0.0/2.2）
                response_format={"type": "json_object"} if json_mode else None,
                timeout=LLM_TIMEOUT_S,
            )
            if usage_out is not None and resp.usage:
                usage_out.append({
                    "input": resp.usage.prompt_tokens,
                    "output": resp.usage.completion_tokens,
                    "total": resp.usage.total_tokens,
                    "model": settings.model,
                })
            return resp.choices[0].message.content or ""
        except Exception as exc:
            last_err = exc
            if attempt < LLM_MAX_ATTEMPTS - 1:
                logger.warning("LLM 调用失败（第 %d 次，%.0fs 超时或瞬时错误），重试: %s",
                               attempt + 1, LLM_TIMEOUT_S, str(exc)[:120])
    raise last_err


async def chat_json(messages: list[dict[str, str]], retries: int = 1, usage_out: list | None = None) -> dict[str, Any]:
    """结构化输出：要求 JSON 并解析，失败自动重试（校验重试机制挂在这里）"""
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        raw = await chat(messages, json_mode=True, usage_out=usage_out)
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            last_err = exc
            messages = messages + [
                {"role": "user", "content": f"上一次输出不是合法 JSON（错误：{exc}），请只输出合法 JSON。"}
            ]
    raise ValueError(f"LLM 结构化输出解析失败（已重试 {retries} 次）: {last_err}")
