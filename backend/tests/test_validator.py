"""Validator 事实一致性校验测试"""
from app.agents.validator import extract_entities, validate_rewrite

RESUME = {
    "education": ["江城理工大学 · 本科 · 2023.09 - 2027.06"],
    "experience": [{
        "company": "校园二手书平台",
        "role": "后端开发",
        "bullets": ["用 FastAPI 实现 12 个接口，QPS 提升 40%"],
    }],
    "skills": ["Python", "FastAPI", "MySQL"],
    "projects": [],
}


def test_extract_entities():
    e = extract_entities("2023-2024 在字节跳动公司做 Go 开发，QPS 提升 40%，分数 92")
    assert "字节跳动公司" in e["orgs"]
    assert any("40" in n for n in e["numbers"])
    assert "Go" in e["skills"]


def test_rewrite_with_fabricated_org_warns():
    # 改写文本凭空出现"字节跳动"——原简历没有
    result = validate_rewrite(RESUME, "在字节跳动公司主导推荐系统，QPS 提升 40%")
    assert result["risk"] == "warning"
    assert any(i["type"] == "new_org" for i in result["issues"])


def test_rewrite_with_new_year_is_fatal():
    # 改写文本出现原简历完全没有的时间线
    result = validate_rewrite(RESUME, "2021 年暑期在某某公司实习，负责数据清洗")
    assert result["risk"] == "fatal"
    assert any(i["type"] == "time_conflict" for i in result["issues"])


def test_consistent_rewrite_passes():
    # 改写仅重排原文事实：数字/机构/时间全部来自原简历
    result = validate_rewrite(RESUME, "使用 Python 与 FastAPI 完成校园二手书平台后端开发，实现 12 个接口")
    assert result["risk"] == "ok"


def test_placeholder_numbers_exempt():
    # 占位符（X%、N 次）不算数字变化
    result = validate_rewrite(RESUME, "优化接口性能，QPS 提升 X%，服务 N 名用户")
    assert not any(i["type"] == "new_number" for i in result["issues"])
