"""生成测试用简历 PDF：内容来自样例简历（样例简历模板），排版模拟主流简历样式

用途：
1. 验收样本——用样例简历验证 Agent 1 解析
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
        (13, "辅导经历"),
        (10, "一对一数据运营 · 初二年级 · 2025暑假"),
        (10, "· 3 学期交易流水 12000 条，学生数学成绩从 天数据处理量 12000 条提升至报表 6 份"),
        (10, "数学集训营助教 · 2025寒假"),
        (10, "· 90 名学员周测数据，学生物理成绩从 90 名学员平均分提升 11 分"),
        (13, "技能"),
        (10, "教学工具：Python（pandas/matplotlib）、SQL 基础、Excel 数据透视表"),
        (10, "教学方法：假设检验、A/B 实验设计、回归分析入门"),
        (10, "编程：Python（程序设计课程实验报告全部满分）"),
        (13, "自我评价"),
        (10, "搭建过班级问卷统计小工具；持续可实习 6 个月"),
    ])
    print(f"生成: {OUT}")


if __name__ == "__main__":
    main()
