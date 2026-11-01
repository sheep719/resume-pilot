"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type {
  MatchResult,
  ProgressState,
  ResumeStructured,
  RewriteSuggestion,
  TraceEntry,
} from "./types";
import { BACKEND_URL, streamSSE } from "./sse";

interface AnalysisState {
  file: File | null;
  jdText: string;
  sessionId: string;
  setInputs: (file: File | null, jdText: string) => void;

  progress: ProgressState;
  resume: ResumeStructured | null;
  warnings: string[];
  match: MatchResult | null;
  rewrites: RewriteSuggestion[];
  trace: TraceEntry[];
  skippedReason: string | null;
  error: string | null;
  finished: boolean;
  started: boolean;
  /** 历史记录版本号：每次分析完成 +1，HistoryPanel 据此自动刷新 */
  historyVersion: number;

  start: () => Promise<void>;
  reset: () => void;
}

const Ctx = createContext<AnalysisState | null>(null);

export function useAnalysis() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAnalysis must be used within AnalysisProvider");
  return v;
}

const IDLE: ProgressState = { parser: "idle", matcher: "idle", rewriter: "idle" };

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState("");

  const [progress, setProgress] = useState<ProgressState>(IDLE);
  const [resume, setResume] = useState<ResumeStructured | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [rewrites, setRewrites] = useState<RewriteSuggestion[]>([]);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [skippedReason, setSkipped] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const ranRef = useRef(false); // 防结果页严格模式双执行重复请求

  const [sessionId] = useState(() => {
    // 浏览器持久 session ID（历史记录粒度，无登录）
    if (typeof window === "undefined") return "ssr";
    let sid = window.localStorage.getItem("rp_session_id");
    if (!sid) {
      // crypto.randomUUID 只在 Secure Context（HTTPS/localhost）可用；
      // 纯 HTTP 部署（如内网 IP 直接访问）会抛 TypeError 使整页崩溃——用 Math.random 兜底
      sid = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8);
      window.localStorage.setItem("rp_session_id", sid);
    }
    return sid;
  });

  const setInputs = useCallback((f: File | null, jd: string) => {
    setFile(f);
    setJdText(jd);
  }, []);

  const reset = useCallback(() => {
    ranRef.current = false;
    setProgress(IDLE);
    setResume(null);
    setWarnings([]);
    setMatch(null);
    setRewrites([]);
    setTrace([]);
    setSkipped(null);
    setError(null);
    setFinished(false);
    setStarted(false);
  }, []);

  const start = useCallback(async () => {
    if (ranRef.current || !file || !jdText.trim()) return;
    ranRef.current = true;
    setStarted(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("jd_text", jdText);
    fd.append("session_id", sessionId);

    try {
      await streamSSE(`${BACKEND_URL}/api/analyze/stream`, fd, (ev, data) => {
        switch (ev) {
          case "progress":
            setProgress((p) => ({ ...p, [data.node]: data.status }));
            break;
          case "resume":
            setResume(data.data);
            setWarnings(data.warnings || []);
            break;
          case "match":
            setMatch(data);
            break;
          case "rewrite":
            setRewrites((r) => [...r, data]);
            break;
          case "trace":
            setTrace(data.trace || []);
            setSkipped(data.skipped ? data.reason || "已跳过改写" : null);
            break;
          case "done":
            setFinished(true);
            setHistoryVersion((v) => v + 1); // 触发 HistoryPanel 刷新，新记录立即可见
            break;
          case "error":
            setError(data.detail);
            setFinished(true);
            break;
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
      setFinished(true);
    }
  }, [file, jdText]);

  return (
    <Ctx.Provider
      value={{
        file, jdText, setInputs, sessionId,
        progress, resume, warnings, match, rewrites, trace,
        skippedReason, error, finished, started, historyVersion,
        start, reset,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
