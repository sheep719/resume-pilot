"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAnalysis } from "@/lib/store";
import HistoryPanel from "@/components/HistoryPanel";

/** 上传页：简历 + JD 输入 */
export default function UploadPage() {
  const { file, jdText, setInputs, start } = useAnalysis();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const ready = !!file && jdText.trim().length > 20;

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setLocalErr("只支持 PDF 或 Word（.docx）文件");
      return;
    }
    setLocalErr(null);
    setInputs(f, jdText);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    router.push("/result");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      {/* 品牌区 */}
      <header className="animate-fade-slide">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 15l2 2 4-4" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-wide text-indigo-600">ResumePilot</span>
        </div>
        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-4xl">
          你的简历和这个岗位，
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">差多远？</span>
        </h1>
        <p className="mt-3 leading-relaxed text-gray-500">
          上传简历、粘贴岗位描述，10 秒得到匹配分数、优势清单、差距分析和逐条改写建议。
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-10 space-y-6">
        {/* 文件拖拽区 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`group cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${
            dragOver
              ? "border-indigo-400 bg-indigo-50/80 shadow-lg shadow-indigo-100"
              : "border-gray-200 bg-white/80 hover:border-indigo-300 hover:bg-white hover:shadow-md"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="animate-fade-in">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </span>
              <p className="mt-3 font-medium text-gray-900">{file.name}</p>
              <p className="mt-1 text-sm text-gray-400">
                {(file.size / 1024).toFixed(0)} KB · 点击可更换
              </p>
            </div>
          ) : (
            <div>
              <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                dragOver ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500"
              }`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M17 8l-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
              </span>
              <p className="mt-3 font-medium text-gray-700">拖拽简历到这里，或点击选择文件</p>
              <p className="mt-1 text-sm text-gray-400">支持 PDF 和 Word（.docx），10MB 以内</p>
            </div>
          )}
        </div>
        {localErr && (
          <p className="animate-fade-in text-sm text-red-600">{localErr}</p>
        )}

        {/* JD 输入 */}
        <div className="animate-fade-slide" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-baseline justify-between">
            <label htmlFor="jd" className="text-sm font-semibold text-gray-900">
              目标岗位 JD
            </label>
            <span className="text-xs text-gray-400">越完整，评分越准</span>
          </div>
          <textarea
            id="jd"
            value={jdText}
            onChange={(e) => setInputs(file, e.target.value)}
            rows={10}
            placeholder={"粘贴完整的招聘 JD（职责 + 要求），例如：\n\n岗位职责\n1. 负责后端服务开发与维护…\n\n任职要求\n1. 熟悉 Python / Go 任一语言…"}
            className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm leading-relaxed outline-none transition placeholder:text-gray-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          <p className="mt-1 text-right text-xs tabular text-gray-300">{jdText.length} 字</p>
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={!ready}
          className={`group flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-medium transition-all duration-200 ${
            ready
              ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-600 hover:shadow-lg active:scale-[0.99]"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
        >
          {ready ? (
            <>
              开始分析
              <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </>
          ) : (
            "请上传简历并粘贴岗位描述（至少 20 字）"
          )}
        </button>
      </form>

      <div className="animate-fade-slide" style={{ animationDelay: "0.14s" }}>
        <HistoryPanel />
      </div>
    </main>
  );
}
