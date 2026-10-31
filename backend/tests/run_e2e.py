"""评测集 E2E：样例简历 × 10 个 JD 全流程 + 评分稳定性指标

v1.2 升级（个人项目裁剪版）：
- 10 组 JD 覆盖不同岗位族（Agent/后端/前端/算法/测试/运维/数开/数分/PM/移动端）
- 稳定性指标：抽 2 个 JD 同输入跑 2 次，对比总分方差（temperature=0 的量化验证）
- Validator 指标：改写建议的实体校验风险分布（fatal/warning/notice 计数）
- 汇总输出对比表，直接可贴进 docs/prompt-iterations.md

跑法：.venv/Scripts/python.exe -X utf8 tests/run_e2e.py [--quick]
  --quick 只跑 3 个核心 JD（成本约 1/3）
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# 环境隔离：E2E 回归的 trace 打 e2e 标签，与真实使用数据在 Langfuse UI 分开筛选
os.environ.setdefault("LANGFUSE_TRACING_ENVIRONMENT", "e2e")

FIXTURES = Path(__file__).parent / "fixtures"

ALL_JDS = [
    "jd_agent_dev.txt", "jd_python_backend.txt", "jd_data_analyst.txt",
    "jd_frontend.txt", "jd_alg.txt", "jd_test.txt", "jd_ops.txt",
    "jd_data_eng.txt", "jd_product.txt", "jd_mobile.txt",
]
QUICK_JDS = ["jd_agent_dev.txt", "jd_python_backend.txt", "jd_data_analyst.txt"]
STABILITY_PROBE = ["jd_agent_dev.txt", "jd_data_analyst.txt"]  # 稳定性抽测对象


async def main():
    import httpx

    from app.agents.parser_agent import parse_resume
    from app.llm import is_stub
    from app.pdf import extract_pdf

    if is_stub():
        print("!! 未配置 DEEPSEEK_API_KEY，stub 模式——非真实测试，退出")
        return 1

    quick = "--quick" in sys.argv
    jds = QUICK_JDS if quick else ALL_JDS

    pdf = (FIXTURES / "my_resume.pdf").read_bytes()
    resume_text = extract_pdf(pdf).text

    print(f"== 解析（1 次真机调用，{len(jds)} 个 JD 复用）==")
    t0 = time.perf_counter()
    resume = await parse_resume(resume_text)
    print(f"   耗时 {time.perf_counter() - t0:.1f}s")

    async with httpx.AsyncClient(timeout=120) as client:
        summary = []
        for jd_name in jds:
            jd_text = (FIXTURES / jd_name).read_text(encoding="utf-8")
            events = await run_stream(client, resume, jd_text)
            row = summarize(jd_name, events)
            print(f"  {row['jd']:24s} 总分 {row['score']:5.1f} | {row['reqs']:2d} 条要求 | "
                  f"{row['rewrites']:2d} 条建议 | 校验 fatal={row['v_fatal']} warn={row['v_warn']} "
                  f"notice={row['v_notice']} | {row['dur']:.1f}s")
            # 断言
            assert row["reqs"] >= 5, f"{jd_name} 要求条数过少: {row['reqs']}"
            assert row["rewrites"] >= 1, f"{jd_name} 无改写建议"
            assert "error" not in events, events.get("error")
            assert row["v_fatal"] == 0, f"{jd_name} 改写建议存在事实风险（fatal）"
            summary.append(row)

        # 稳定性：同输入跑 2 次对比总分（temperature=0 的量化验证）
        print("\n== 稳定性抽测（同输入 × 2 次）==")
        stability = []
        for jd_name in STABILITY_PROBE:
            jd_text = (FIXTURES / jd_name).read_text(encoding="utf-8")
            scores = []
            for run_i in range(2):
                events = await run_stream(client, resume, jd_text)
                match = (events.get("match") or [{}])[0]
                scores.append(match.get("total_score") or 0)
            drift = abs(scores[0] - scores[1])
            stability.append({"jd": jd_name, "scores": scores, "drift": drift})
            print(f"  {jd_name:24s} 两次总分 {scores[0]:.1f} / {scores[1]:.1f} | 漂移 {drift:.1f}")
            assert drift <= 5.0, f"{jd_name} 评分漂移过大: {drift}（>5 分不可接受）"

    print("\n==== 评测汇总 ====")
    print(f"{'JD':26s} {'总分':>5s}  {'要求':>4s}  {'建议':>4s}  校验风险(f/w/n)")
    for s in summary:
        print(f"{s['jd']:26s} {s['score']:5.1f}  {s['reqs']:4d}  {s['rewrites']:4d}  "
              f"{s['v_fatal']}/{s['v_warn']}/{s['v_notice']}")
    print(f"\n稳定性: 最大漂移 {max(s['drift'] for s in stability):.1f} 分（阈值 5.0）")
    print("PASS" if not quick else "PASS (quick 模式，3 JD)")
    return 0


async def run_stream(client, resume: dict, jd_text: str) -> dict:
    events = {}
    async with client.stream(
        "POST",
        "http://127.0.0.1:8000/api/analyze/stream",
        data={"resume": json.dumps(resume, ensure_ascii=False),
              "jd_text": jd_text, "session_id": "e2e-verify"},
    ) as resp:
        assert resp.status_code == 200, f"HTTP {resp.status_code}"
        async for ev, data in aiter_sse(resp):
            events.setdefault(ev, []).append(data)
    return events


def summarize(jd_name: str, events: dict) -> dict:
    match = (events.get("match") or [{}])[0]
    rewrites = events.get("rewrite", [])
    v_fatal = sum(1 for r in rewrites if r.get("validation", {}).get("risk") == "fatal")
    v_warn = sum(1 for r in rewrites if r.get("validation", {}).get("risk") == "warning")
    v_notice = sum(1 for r in rewrites if r.get("validation", {}).get("risk") == "notice")
    return {
        "jd": jd_name, "score": match.get("total_score", 0),
        "reqs": len(match.get("requirements", [])), "rewrites": len(rewrites),
        "v_fatal": v_fatal, "v_warn": v_warn, "v_notice": v_notice,
        "dur": 0,
    }


async def aiter_sse(resp):
    ev = None
    async for raw in resp.aiter_lines():
        if raw.startswith("event: "):
            ev = raw[7:]
        elif raw.startswith("data: ") and ev:
            yield ev, json.loads(raw[6:])
            ev = None


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
