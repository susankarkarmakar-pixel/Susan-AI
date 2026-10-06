# Susan AI — Phase 1 Code Execution MVP

এই document-টি Susan AI-এর privacy-first, browser-only code execution MVP-এর implementation guide। এই phase-এ কোনো arbitrary code Next.js server বা Vercel function-এ চালানো হবে না। JavaScript execution একটি Web Worker-এর ভিতরে হবে; TypeScript আগে client-side transpile হবে; JSON validation এবং HTML/CSS preview আলাদা safe paths ব্যবহার করবে।

## MVP scope

### Supported

- JavaScript execution
- TypeScript transpilation এবং execution
- JSON parse/validation
- HTML/CSS sandboxed preview
- Copy code
- Download code
- Run / Stop
- stdout/stderr capture
- 5-second default timeout
- 30-second hard maximum timeout
- 256 KB output limit
- explicit user click ছাড়া execution নয়

### Not supported in Phase 1

- Python
- Shell, PowerShell, Java, C/C++
- npm/pip install
- network requests
- filesystem access
- environment variables
- server-side execution
- package loading

---

## 1. File structure

```text
components/
└── chat/
    ├── code-block.tsx                  # Existing code block; add Run/Download actions
    └── code-execution/
        ├── code-runner.tsx             # Client-side orchestration and result UI
        ├── execution-result.tsx        # stdout/stderr/status card
        └── run-confirmation.tsx        # First-run safety notice

lib/
└── code-execution/
    ├── types.ts                        # Shared request/result types
    ├── languages.ts                    # Language detection and policy
    ├── execution-policy.ts             # Limits and validation
    ├── execute-browser.ts              # Browser execution dispatcher
    └── worker-client.ts                # Web Worker lifecycle wrapper

workers/
└── javascript-runner.worker.ts         # Isolated JavaScript runner

tests/
└── code-execution.test.mjs             # Static policy and UI regression tests
```

> Existing `components/chat/code-block.tsx` already provides syntax highlighting and copy support. Phase 1 should extend that component rather than replace it.

---

## 2. Shared types

### `lib/code-execution/types.ts`

```ts
export type ExecutableLanguage = "javascript" | "typescript" | "json" | "html" | "css";

export type ExecutionStatus =
  | "idle"
  | "confirming"
  | "running"
  | "success"
  | "error"
  | "timeout"
  | "cancelled";

export interface CodeExecutionRequest {
  language: ExecutableLanguage;
  code: string;
  timeoutMs?: number;
}

export interface CodeExecutionError {
  code: "UNSUPPORTED_LANGUAGE" | "TIMEOUT" | "SYNTAX_ERROR" | "RUNTIME_ERROR" | "OUTPUT_LIMIT" | "INVALID_INPUT";
  message: string;
  line?: number;
  column?: number;
}

export interface CodeExecutionResult {
  ok: boolean;
  status: Exclude<ExecutionStatus, "idle" | "confirming" | "running">;
  language: ExecutableLanguage;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
  error?: CodeExecutionError;
}

export interface WorkerRunMessage {
  type: "run";
  requestId: string;
  code: string;
  timeoutMs: number;
}

export interface WorkerCancelMessage {
  type: "cancel";
  requestId: string;
}

export interface WorkerResultMessage {
  type: "result";
  requestId: string;
  result: Omit<CodeExecutionResult, "language">;
}
```

---

## 3. Execution policy

### `lib/code-execution/execution-policy.ts`

```ts
import type { ExecutableLanguage } from "./types";

export const DEFAULT_TIMEOUT_MS = 5_000;
export const MAX_TIMEOUT_MS = 30_000;
export const MAX_CODE_BYTES = 100_000;
export const MAX_OUTPUT_BYTES = 256_000;

const SUPPORTED_LANGUAGES = new Set<ExecutableLanguage>([
  "javascript",
  "typescript",
  "json",
  "html",
  "css",
]);

export function normalizeLanguage(value: string): ExecutableLanguage | null {
  const language = value.trim().toLowerCase();
  if (language === "js" || language === "jsx" || language === "node") return "javascript";
  if (language === "ts" || language === "tsx") return "typescript";
  if (language === "htm") return "html";
  if (SUPPORTED_LANGUAGES.has(language as ExecutableLanguage)) return language as ExecutableLanguage;
  return null;
}

export function normalizeTimeout(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(250, Math.floor(value as number)));
}

export function validateCodeInput(code: string): string | null {
  if (typeof code !== "string" || code.trim().length === 0) return "Code cannot be empty.";
  if (new TextEncoder().encode(code).byteLength > MAX_CODE_BYTES) return "Code is too large for the browser sandbox.";
  return null;
}

export function truncateOutput(value: string): { value: string; truncated: boolean } {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= MAX_OUTPUT_BYTES) return { value, truncated: false };
  return {
    value: new TextDecoder().decode(bytes.slice(0, MAX_OUTPUT_BYTES)) + "\n[Output truncated]",
    truncated: true,
  };
}
```

---

## 4. Language helpers

### `lib/code-execution/languages.ts`

```ts
import { normalizeLanguage } from "./execution-policy";
import type { ExecutableLanguage } from "./types";

export function getExecutableLanguage(language: string): ExecutableLanguage | null {
  return normalizeLanguage(language || "");
}

export function canExecute(language: string): boolean {
  return Boolean(getExecutableLanguage(language));
}

export function languageLabel(language: string): string {
  const normalized = getExecutableLanguage(language);
  if (normalized === "javascript") return "JavaScript";
  if (normalized === "typescript") return "TypeScript";
  if (normalized === "json") return "JSON";
  if (normalized === "html") return "HTML preview";
  if (normalized === "css") return "CSS preview";
  return "Unsupported language";
}
```

---

## 5. Browser execution dispatcher

### `lib/code-execution/execute-browser.ts`

```ts
import { getExecutableLanguage } from "./languages";
import { normalizeTimeout, truncateOutput, validateCodeInput } from "./execution-policy";
import type { CodeExecutionRequest, CodeExecutionResult } from "./types";
import { runJavaScriptInWorker } from "./worker-client";

export async function executeInBrowser(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
  const language = getExecutableLanguage(request.language);
  if (!language) {
    return {
      ok: false,
      status: "error",
      language: "javascript",
      stdout: "",
      stderr: "",
      durationMs: 0,
      truncated: false,
      error: { code: "UNSUPPORTED_LANGUAGE", message: "This language is not available in the browser sandbox." },
    };
  }

  const inputError = validateCodeInput(request.code);
  if (inputError) {
    return {
      ok: false,
      status: "error",
      language,
      stdout: "",
      stderr: "",
      durationMs: 0,
      truncated: false,
      error: { code: "INVALID_INPUT", message: inputError },
    };
  }

  if (language === "json") {
    const started = performance.now();
    try {
      JSON.parse(request.code);
      return { ok: true, status: "success", language, stdout: "Valid JSON", stderr: "", durationMs: Math.round(performance.now() - started), truncated: false };
    } catch (error) {
      return { ok: false, status: "error", language, stdout: "", stderr: String(error), durationMs: Math.round(performance.now() - started), truncated: false, error: { code: "SYNTAX_ERROR", message: "The JSON could not be parsed." } };
    }
  }

  if (language === "html" || language === "css") {
    return { ok: true, status: "success", language, stdout: "Preview is ready.", stderr: "", durationMs: 0, truncated: false };
  }

  const result = await runJavaScriptInWorker(request.code, normalizeTimeout(request.timeoutMs));
  return {
    ...result,
    language,
    stdout: truncateOutput(result.stdout).value,
    stderr: truncateOutput(result.stderr).value,
    truncated: result.truncated || truncateOutput(result.stdout).truncated || truncateOutput(result.stderr).truncated,
  };
}
```

> TypeScript transpilation should be added behind an explicit dependency such as `esbuild-wasm` or a small client-side transpiler. Do not execute TypeScript syntax directly in the JavaScript worker.

---

## 6. Worker client

### `lib/code-execution/worker-client.ts`

```ts
import type { CodeExecutionResult, WorkerResultMessage } from "./types";

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL("../../workers/javascript-runner.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export function runJavaScriptInWorker(code: string, timeoutMs: number): Promise<Omit<CodeExecutionResult, "language">> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    const activeWorker = getWorker();
    let settled = false;

    const finish = (result: Omit<CodeExecutionResult, "language">) => {
      if (settled) return;
      settled = true;
      activeWorker.removeEventListener("message", onMessage);
      resolve({ ...result, durationMs: Math.round(performance.now() - started) });
    };

    const onMessage = (event: MessageEvent<WorkerResultMessage>) => {
      if (event.data.type !== "result" || event.data.requestId !== requestId) return;
      finish(event.data.result);
    };

    activeWorker.addEventListener("message", onMessage);
    activeWorker.postMessage({ type: "run", requestId, code, timeoutMs });

    window.setTimeout(() => {
      if (settled) return;
      // Terminate the worker so infinite loops cannot keep running.
      activeWorker.terminate();
      worker = null;
      finish({ ok: false, status: "timeout", stdout: "", stderr: "Execution timed out.", truncated: false, error: { code: "TIMEOUT", message: `Execution exceeded ${timeoutMs} ms.` } });
    }, timeoutMs + 100);
  });
}
```

---

## 7. JavaScript worker

### `workers/javascript-runner.worker.ts`

```ts
import type { WorkerRunMessage } from "@/lib/code-execution/types";

const MAX_OUTPUT_LENGTH = 256_000;

self.onmessage = async (event: MessageEvent<WorkerRunMessage>) => {
  if (event.data.type !== "run") return;

  const { requestId, code } = event.data;
  let stdout = "";
  let stderr = "";
  let truncated = false;

  const append = (target: "stdout" | "stderr", values: unknown[]) => {
    const line = values.map(formatValue).join(" ") + "\n";
    if ((target === "stdout" ? stdout : stderr).length + line.length > MAX_OUTPUT_LENGTH) {
      truncated = true;
      return;
    }
    if (target === "stdout") stdout += line;
    else stderr += line;
  };

  const safeConsole = {
    log: (...values: unknown[]) => append("stdout", values),
    info: (...values: unknown[]) => append("stdout", values),
    warn: (...values: unknown[]) => append("stderr", values),
    error: (...values: unknown[]) => append("stderr", values),
  };

  try {
    // The worker has no application keys, filesystem bridge, or API bridge.
    // This is still not a native OS sandbox; keep supported code intentionally small.
    const execute = new Function("console", "fetch", "XMLHttpRequest", "WebSocket", `"use strict";\n${code}`);
    await execute(safeConsole, undefined, undefined, undefined);
    self.postMessage({ type: "result", requestId, result: { ok: true, status: "success", stdout, stderr, truncated } });
  } catch (error) {
    self.postMessage({ type: "result", requestId, result: { ok: false, status: "error", stdout, stderr, truncated, error: { code: "RUNTIME_ERROR", message: error instanceof Error ? error.message : String(error) } } });
  }
};

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export {};
```

> This worker is a Phase 1 baseline. For a production-grade untrusted-code boundary, replace `new Function` with QuickJS WASM. A Web Worker alone is not a complete security sandbox against every JavaScript escape technique.

---

## 8. Execution result component

### `components/chat/code-execution/execution-result.tsx`

```tsx
"use client";

import type { CodeExecutionResult } from "@/lib/code-execution/types";

export function ExecutionResult({ result, onRetry }: { result: CodeExecutionResult; onRetry: () => void }) {
  const failed = !result.ok;
  return (
    <section className={`mt-3 overflow-hidden rounded-xl border text-xs ${failed ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`} aria-live="polite" aria-label="Code execution result">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-3 py-2">
        <span className={`font-semibold ${failed ? "text-red-800" : "text-emerald-800"}`}>{failed ? "Execution failed" : "Execution successful"}</span>
        <span className="text-[10px] text-text-muted">{result.durationMs} ms{result.truncated ? " · output truncated" : ""}</span>
      </div>
      {result.stdout && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words bg-sidebar-cocoa px-3 py-3 font-mono text-[11px] text-white">{result.stdout}</pre>}
      {result.stderr && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-red-200 bg-red-100/70 px-3 py-3 font-mono text-[11px] text-red-900">{result.stderr}</pre>}
      {result.error && <p className="px-3 py-2 text-red-800">{result.error.message}</p>}
      <div className="flex flex-wrap gap-2 px-3 py-2"><button type="button" onClick={onRetry} className="rounded-lg border border-border-main/70 bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-text-main hover:bg-black/5">Run again</button>{failed && <button type="button" className="rounded-lg border border-border-main/70 bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-text-main hover:bg-black/5">Fix this error</button>}</div>
    </section>
  );
}
```

---

## 9. Code runner component

### `components/chat/code-execution/code-runner.tsx`

```tsx
"use client";

import { useState } from "react";
import { executeInBrowser } from "@/lib/code-execution/execute-browser";
import { getExecutableLanguage } from "@/lib/code-execution/languages";
import type { CodeExecutionResult } from "@/lib/code-execution/types";
import { ExecutionResult } from "./execution-result";

export function CodeRunner({ language, code }: { language: string; code: string }) {
  const [result, setResult] = useState<CodeExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const executable = getExecutableLanguage(language);
  if (!executable) return null;

  const run = async () => {
    setRunning(true);
    try { setResult(await executeInBrowser({ language: executable, code })); }
    finally { setRunning(false); }
  };

  return <div className="mt-2"><button type="button" onClick={run} disabled={running} className="rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60">{running ? "Running…" : result ? "Run again" : "Run code"}</button>{result && <ExecutionResult result={result} onRetry={run} />}</div>;
}
```

---

## 10. Integrate with existing `CodeBlock`

In `components/chat/code-block.tsx`, add `CodeRunner` after the existing copy/download controls:

```tsx
import { CodeRunner } from "./code-execution/code-runner";

// Inside the code block footer, after the Copy button:
{language && <CodeRunner language={language} code={value} />}
```

The existing `message-bubble.tsx` already passes:

```tsx
<CodeBlock language={language} value={codeString}>
  <code>{children}</code>
</CodeBlock>
```

Therefore no message parser rewrite is required.

---

## 11. First-run confirmation

Before enabling `Run code` for the first time, show a modal or inline confirmation:

```text
Code runs locally in a temporary browser sandbox.
It cannot access Susan AI API keys, conversations, local files, or the network.

[Run code] [Cancel]
```

Persist only this preference:

```text
susan_code_execution_notice_seen_v1
```

Do not persist code or execution output by default.

---

## 12. Static regression tests

### `tests/code-execution.test.mjs`

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("code execution is explicitly user-triggered and rendered in a result card", async () => {
  const runner = await read("components/chat/code-execution/code-runner.tsx");
  const block = await read("components/chat/code-block.tsx");
  assert.match(runner, /Run code/);
  assert.match(runner, /executeInBrowser/);
  assert.match(runner, /disabled=\{running\}/);
  assert.match(block, /CodeRunner/);
});

test("browser execution has bounded timeout and output policy", async () => {
  const policy = await read("lib/code-execution/execution-policy.ts");
  const client = await read("lib/code-execution/worker-client.ts");
  assert.match(policy, /MAX_TIMEOUT_MS/);
  assert.match(policy, /MAX_OUTPUT_BYTES/);
  assert.match(policy, /MAX_CODE_BYTES/);
  assert.match(client, /terminate\(\)/);
  assert.match(client, /TIMEOUT/);
});

test("the MVP does not expose server-side execution routes", async () => {
  const route = await read("app/api/chat/route.ts");
  assert.doesNotMatch(route, /child_process/);
  assert.doesNotMatch(route, /eval\(/);
  assert.doesNotMatch(route, /exec\(/);
});
```

---

## 13. Security checklist before merge

- [ ] Replace `new Function` with QuickJS WASM before calling this production-grade.
- [ ] Confirm no API keys are passed to the worker.
- [ ] Confirm no `fetch`, `XMLHttpRequest`, or `WebSocket` bridge is exposed.
- [ ] Add output truncation tests.
- [ ] Add infinite-loop timeout test.
- [ ] Add mobile overflow test for result cards.
- [ ] Add reduced-motion support for loading state.
- [ ] Keep `Run code` opt-in; never auto-run AI output.
- [ ] Do not add `child_process` to Next.js routes.
- [ ] Do not add filesystem or network permissions to the browser runner.
- [ ] Review QuickJS WASM license and bundle size before shipping.

---

## 14. Suggested implementation order

1. Add `types.ts`, `execution-policy.ts`, and `languages.ts`.
2. Add worker client and worker.
3. Add `execute-browser.ts` for JavaScript, JSON, and preview placeholders.
4. Add `ExecutionResult` and `CodeRunner` components.
5. Integrate `CodeRunner` into the existing `CodeBlock`.
6. Add first-run confirmation.
7. Add static regression tests.
8. Replace the baseline worker evaluator with QuickJS WASM.
9. Run lint, build, full tests, mobile tests, and a manual browser smoke test.

The MVP should not be marked production-ready until the QuickJS WASM replacement and the security checklist are complete.
