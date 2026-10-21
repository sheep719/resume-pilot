"""Validator · 事实一致性校验（规则引擎，零 LLM 成本）

借鉴自可靠性工程清单 #2，但砍掉 LLM 二次校验（改写器 prompt 已有防编造约束 +
占位符规范，规则引擎做最后一道硬防线足够）——双校验的边际收益配不上成本。

三级风险：
- fatal   时间冲突（改写文本出现原文没有的时间段且与已有时间重叠）
- warning 新增原文没有的实体（公司名/项目名/技能名词）
- notice  数字变化（量化成果被改动——占位符 X/N 约定的除外）

每个校验项带证据（原文 vs 改写文本的实体对照），前端红色高亮 fatal/warning。
"""
import re

# 实体抽取模式（简历文本的中式表达约定）
YEAR_RANGE = re.compile(r"(20\d{2})\s*[.年/-]\s*(?:\d{1,2}\s*[.月/-]?\s*)?(?:-|—|~|至|到)\s*(?:20\d{2}|今|现在|present)?")
COMPANY_ORG = re.compile(r"(?:@|在|于|就职于)\s*([一-龥A-Za-z0-9·]{2,20}(?:公司|大学|学院|集团|实验室|工作室|平台))")
NUMBERS = re.compile(r"\d+(?:\.\d+)?\s*(?:%|万|k|K|分|次|个|人|天|小时|课时|条|元)")
ORG_SUFFIX = re.compile(r"[一-龥A-Za-z0-9·]{2,20}(?:公司|大学|学院|集团|实验室|工作室|平台)")

# 机构名前常见的动词/连词会污染实体（如"完成校园二手书平台"），匹配后剥离
ORG_PREFIX_VERBS = ("完成", "使用", "利用", "基于", "开发", "搭建", "加入", "负责", "主导", "参与", "通过", "在于", "就职于", "实习于", "在")

# 占位符约定（改写器生成的模板允许出现，不算数字变化）
PLACEHOLDER = re.compile(r"[Xx］数]|N\s*次|若干")

SKILL_WORDS = {
    "Python", "Java", "Go", "SQL", "MySQL", "Docker", "Kubernetes", "K8s",
    "LangChain", "LangGraph", "FastAPI", "Flask", "Django", "React", "Vue",
    "Next.js", "TypeScript", "JavaScript", "CSS", "HTML", "Git", "Linux",
    "Redis", "MongoDB", "PostgreSQL", "RAG", "SSE", "pandas", "numpy",
}


def extract_entities(text: str) -> dict[str, set[str]]:
    """从简历/改写文本抽取实体：组织名、时间范围、数字、技能词"""
    orgs = set()
    for m in ORG_SUFFIX.finditer(text):
        org = m.group()
        # 剥离被吞进机构名的动词前缀（"完成校园二手书平台" → "校园二手书平台"）
        changed = True
        while changed:
            changed = False
            for verb in ORG_PREFIX_VERBS:
                if org.startswith(verb) and len(org) > len(verb) + 1:
                    org = org[len(verb):]
                    changed = True
        orgs.add(org)
    for m in COMPANY_ORG.finditer(text):
        orgs.add(m.group(1))

    years = set(YEAR_RANGE.findall(text))
    # 补抓裸年份（教育起止）
    for y in re.findall(r"(20\d{2})", text):
        years.add(y)

    nums = set()
    for m in NUMBERS.finditer(text):
        token = m.group().strip()
        if not PLACEHOLDER.search(token):  # 占位符豁免
            nums.add(token)
    # 裸整数也抓（分数如 92、118）
    for m in re.findall(r"(?<![\d.])(\d{2,4})(?![\d.%])", text):
        if not PLACEHOLDER.search(m):
            nums.add(m)

    skills = {s for s in SKILL_WORDS if s.lower() in text.lower()}

    return {"orgs": orgs, "years": years, "numbers": nums, "skills": skills}


def validate_rewrite(original_resume: dict, rewritten: str) -> dict:
    """校验一条改写建议与原简历的事实一致性

    original_resume: Agent 1 输出的结构化简历 JSON
    rewritten: 改写器输出的 rewritten 文本
    返回: {"risk": "fatal|warning|notice|ok", "issues": [{"type", "detail", "evidence"}]}
    """
    # 把结构化简历拼回纯文本做实体抽取
    resume_text = _flatten_resume(original_resume)
    src = extract_entities(resume_text)
    dst = extract_entities(rewritten)

    issues = []

    # 1) 新增组织实体（改写文本出现原简历没有的公司/学校）→ warning
    new_orgs = dst["orgs"] - src["orgs"]
    for org in new_orgs:
        issues.append({
            "type": "new_org",
            "level": "warning",
            "detail": f"改写中出现了原简历没有的机构「{org}」",
            "evidence": org,
        })

    # 2) 新增技能名词（原简历完全没提的技能被写实）→ warning
    new_skills = dst["skills"] - src["skills"]
    for skill in new_skills:
        issues.append({
            "type": "new_skill",
            "level": "warning",
            "detail": f"改写中出现了原简历没有的技能「{skill}」——若你确实掌握请在原简历补充后使用",
            "evidence": skill,
        })

    # 3) 数字比对：改写文本中出现原文完全没有的数字 → notice（占位符已豁免）
    new_nums = dst["numbers"] - src["numbers"]
    for num in list(new_nums)[:3]:  # 最多报 3 条避免刷屏
        issues.append({
            "type": "new_number",
            "level": "notice",
            "detail": f"改写中出现原文没有的数字「{num}」——确认是你自己的真实数据再使用",
            "evidence": num,
        })

    # 4) 时间冲突：改写文本出现原文没有的年份（占位/泛化时间如"202X"已豁免）→ fatal
    new_years = dst["years"] - src["years"]
    for year in new_years:
        issues.append({
            "type": "time_conflict",
            "level": "fatal",
            "detail": f"改写中出现原文没有的时间「{year}」——疑似虚构经历时间线，请改为你的真实时间",
            "evidence": year,
        })

    risk = "ok"
    if any(i["level"] == "fatal" for i in issues):
        risk = "fatal"
    elif any(i["level"] == "warning" for i in issues):
        risk = "warning"
    elif issues:
        risk = "notice"

    return {"risk": risk, "issues": issues}


def _flatten_resume(resume: dict) -> str:
    """结构化简历 → 纯文本（供实体抽取）"""
    parts = []
    parts.extend(resume.get("education", []))
    for exp in resume.get("experience", []):
        parts.append(f"{exp.get('company', '')} {exp.get('role', '')}")
        parts.extend(exp.get("bullets", []))
    parts.extend(resume.get("skills", []))
    parts.extend(resume.get("projects", []))
    return "\n".join(parts)
