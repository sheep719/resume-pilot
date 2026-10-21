"""文档文本提取（pdfplumber / python-docx 双解析器路由）

职责边界（产品红线）：
- 只处理文本型文件；图片型/扫描件 PDF 直接报错提示，不搞 OCR
- 检测双栏布局（常见解析坑），提取结果带警告
"""
from dataclasses import dataclass, field

import pdfplumber


@dataclass
class PDFExtractResult:
    text: str
    pages: int
    warnings: list[str] = field(default_factory=list)


class NotTextPDFError(Exception):
    """图片型/扫描件 PDF（无可提取文本）"""


class UnsupportedFileError(Exception):
    """不支持的文件类型"""


def extract_pdf(file_bytes: bytes) -> PDFExtractResult:
    """提取 PDF 全文文本，附布局警告"""
    import io

    warnings: list[str] = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        pages = len(pdf.pages)
        page_texts: list[str] = []
        two_column_pages = 0

        for page in pdf.pages:
            text = page.extract_text() or ""
            page_texts.append(text)

            # 双栏检测：单页字符 x 坐标中位数明显分成左右两簇
            if page.chars:
                mid = (page.bbox[0] + page.bbox[2]) / 2
                right = sum(1 for c in page.chars if c["x0"] > mid)
                ratio = right / len(page.chars)
                if 0.35 < ratio < 0.65:
                    two_column_pages += 1

        text = "\n".join(page_texts).strip()

    if not text:
        raise NotTextPDFError(
            "未能从 PDF 提取到文本，可能为扫描件/图片型 PDF，请上传文本型 PDF"
        )

    if two_column_pages:
        warnings.append(
            f"检测到 {two_column_pages} 页疑似双栏布局，段落顺序可能与视觉顺序不一致，解析结果请人工复核"
        )

    return PDFExtractResult(text=text, pages=pages, warnings=warnings)


def extract_docx(file_bytes: bytes) -> PDFExtractResult:
    """提取 DOCX 全文文本（段落 + 表格，按文档顺序拼接）"""
    import io

    import docx  # python-docx

    d = docx.Document(io.BytesIO(file_bytes))
    lines: list[str] = []

    # python-docx 不保证段落与表格的先后顺序，按 body 元素流式遍历
    from docx.oxml.ns import qn

    body = d.element.body
    para_iter = iter(d.paragraphs)
    table_iter = iter(d.tables)
    for child in body.iterchildren():
        if child.tag == qn("w:p"):
            try:
                lines.append(next(para_iter).text.strip())
            except StopIteration:
                pass
        elif child.tag == qn("w:tbl"):
            try:
                for row in next(table_iter).rows:
                    lines.append(" | ".join(c.text.strip() for c in row.cells))
            except StopIteration:
                pass

    text = "\n".join(l for l in lines if l).strip()
    if not text:
        raise NotTextPDFError("未能从 DOCX 提取到文本（可能为空文档或纯图片）")
    return PDFExtractResult(text=text, pages=1, warnings=[])


def extract_document(filename: str, file_bytes: bytes) -> PDFExtractResult:
    """按扩展名路由到对应解析器（#4 多解析器路由）"""
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return extract_pdf(file_bytes)
    if name.endswith(".docx"):
        return extract_docx(file_bytes)
    raise UnsupportedFileError("只支持 PDF / DOCX 文件")
