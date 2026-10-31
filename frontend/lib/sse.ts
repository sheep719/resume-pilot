/** 后端地址：默认走 Next rewrites 代理（/backend/* → backend :8000），浏览器永远同源。
 *  可用 NEXT_PUBLIC_BACKEND_URL 覆盖为直连（本机开发时不走代理调 :8000）。
 *  原理：standalone 模式下 NEXT_PUBLIC_* 是 build 时烘焙的——compose 运行时注入
 *  根本不起作用，所以默认值必须是相对路径（同源），不是绝对 URL。 */
export const BACKEND_URL =
  (typeof window !== "undefined" && window.__RP_BACKEND_URL__) ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "/backend";

declare global {
  interface Window {
    __RP_BACKEND_URL__?: string;  // 运行时调试逃生舱：控制台可临时改后端地址
  }
}

/** 手写 SSE 客户端：fetch POST + ReadableStream（EventSource 不支持 POST） */
export async function streamSSE(
  url: string,
  body: FormData,
  onEvent: (event: string, data: any) => void,
): Promise<void> {
  const resp = await fetch(url, { method: "POST", body });
  if (!resp.ok || !resp.body) {
    let detail = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      detail = j.detail || detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split("\n\n");
    buf = blocks.pop() || "";
    for (const block of blocks) {
      const ev = block.match(/^event: (.+)$/m)?.[1];
      const raw = block.match(/^data: (.+)$/m)?.[1];
      if (ev && raw) {
        try {
          onEvent(ev, JSON.parse(raw));
        } catch {
          /* 忽略坏块 */
        }
      }
    }
  }
}
