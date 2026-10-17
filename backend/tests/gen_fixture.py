"""生成测试用简历 PDF：虚构样例人物（张远航），排版模拟主流简历样式

用途：
1. 端到端验收样本——用样例简历验证 Agent 1 解析
2. pytest fixture 之外的手工测试入口
"""
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "my_resume.pdf"

FONT = None
for name, candidates in {
    "msyh": [r"C:\Windows\Fonts\msyh.ttc"],
    "simhei": [r"C:\Windows\Fonts\simhei.ttf"],
    "simsun": [r"C:\Windows\Fonts\simsun.ttc"],
}.items():
    for c in candidates:
        if Path(c).exists():
            pdfmetrics.registerFont(TTFont(name, c))
            FONT = name
            break
    if FONT:
        break

if not FONT:
    raise SystemExit("未找到中文字体（msyh/simhei/simsun），无法生成测试 PDF")


def draw(cv: canvas.Canvas, lines: list[tuple[int, str]]):
    """lines: (字号, 文本) 列表，从页顶往下排"""
    cv.setFont(FONT, 10)
    width, height = A4
    y = height - 60
    for size, text in lines:
        cv.setFont(FONT, size)
        cv.drawString(60, y, text)
        y -= size + 8
    cv.save()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    cv = canvas.Canvas(str(OUT), pagesize=A4)
    cv.setTitle("张远航-简历")
    draw(cv, [
        (18, "张 远 航"),
        (10, "男 · 21 岁 · 本科 · 江城理工大学"),
        (10, "电话：138****0000 · 邮箱：zhangyh@example.com"),
        (13, "教育经历"),
        (10, "江城理工大学 · 本科 · 2023.09 - 2027.06"),
        (10, "主修课程：统计学、线性代数、Python 程序设计"),
        (13, "实践经历"),
        (10, "校园二手书平台数据运营 · 2024暑假"),
        (10, "· 用 pandas 清洗 3 学期交易流水 12000 条，输出热门品类报表 6 份"),
        (10, "数学集训营助教 · 2025寒假"),
        (10, "· 跟踪 3 个班 90 名学员的周测数据，结营平均分提升 11 分"),
        (13, "技能"),
        (10, "数据分析：Python（pandas/matplotlib）、SQL 基础、Excel 数据透视表"),
        (10, "统计方法：假设检验、A/B 实验设计、回归分析入门"),
        (10, "编程：Python（程序设计课程实验报告全部满分）"),
        (13, "自我评价"),
        (10, "对数字敏感，喜欢从数据里找规律；搭建过班级问卷统计小工具，持续可实习 6 个月"),
    ])
    print(f"生成: {OUT}")


if __name__ == "__main__":
    main()
