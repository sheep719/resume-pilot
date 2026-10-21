"""DOCX 解析与文件路由测试"""
import pytest

from app.pdf import (
    NotTextPDFError,
    UnsupportedFileError,
    extract_docx,
    extract_document,
)


def _make_docx() -> bytes:
    """程序生成一个含段落+表格的 docx"""
    import io

    import docx

    d = docx.Document()
    d.add_paragraph("张三 · 本科 · 江城大学")
    d.add_paragraph("技能：Python、SQL")
    tb = d.add_table(rows=1, cols=2)
    tb.rows[0].cells[0].text = "项目"
    tb.rows[0].cells[1].text = "校园助手 App"
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def test_extract_docx_paragraphs_and_tables():
    result = extract_docx(_make_docx())
    assert "张三" in result.text
    assert "Python" in result.text
    assert "校园助手 App" in result.text  # 表格内容也被提取


def test_route_by_extension():
    docx_bytes = _make_docx()
    r = extract_document("简历.docx", docx_bytes)
    assert "张三" in r.text

    with pytest.raises(UnsupportedFileError):
        extract_document("简历.doc", b"")  # 老格式 .doc 不支持

    with pytest.raises((UnsupportedFileError, NotTextPDFError)):
        extract_document("简历.txt", b"plain text")
