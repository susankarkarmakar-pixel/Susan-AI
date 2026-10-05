# Susan AI — পরবর্তী Development Roadmap

> **Roadmap scope:** বর্তমান Susan AI workspace-এর পরবর্তী ৮–১২ সপ্তাহের product এবং engineering phase। এটি একটি prioritised plan; সময়গুলো indicative এবং implementation capacity, provider/API changes, এবং user feedback অনুযায়ী adjust করা যাবে।

## 1. বর্তমান অবস্থার সারসংক্ষেপ

Susan AI এখন একটি privacy-first, browser-local, multi-model AI workspace হিসেবে একটি শক্ত foundation তৈরি করেছে:

- **Multi-provider chat:** Gemini, OpenAI, Claude, DeepSeek, OpenRouter, Hugging Face, Qwen, Kimi, Manus, Sarvam এবং custom OpenAI-compatible providers।
- **BYOK এবং local-first storage:** browser-local encrypted key storage, conversation history, projects, Knowledge Base এবং IndexedDB document library।
- **Smart Attachment Workflow:** drag-and-drop, batch upload, duplicate protection, file categorisation, PDF text extraction, scanned-PDF page rendering + OCR, multilingual OCR, preview modal, progress state এবং extracted-context controls।
- **Agent Workspace:** task planning, approval flow, execution timeline, tool registry, live output, data preview এবং PDF/DOCX/XLSX report export।
- **Responsive UI:** desktop ও mobile layouts, mobile Settings/About sheets, safe-area spacing, PWA manifest এবং mobile responsive contract tests।
- **Quality gates:** source-level mobile tests, Chromium mobile smoke tests, runtime smoke tests, lint, TypeScript এবং production build checks।

### বর্তমান baseline — 2026-10-06

- Source-level mobile suite: **6 tests passing**
- Real-browser mobile E2E suite: **16 tests passing**
- Full Node regression: **126 passing, 1 intentional skip**
- ESLint: passing; TypeScript check: passing
- Next.js **16.3.8** production build: passing
- Dependency audit policy: **no critical or unapproved high-severity findings**; the exact unpatched `braces` advisory in the development-only lint chain is temporarily allowlisted, while moderate `exceljs`/`uuid` advisories remain visible and non-blocking
- GitHub Actions PR quality-gate workflow is configured; first hosted run is pending the follow-up PR
- Phase 2 initial slice: TXT/Markdown/CSV/JSON document text is indexed locally (120,000-character cap), full-text search works in Documents, and “Use in chat” prepares an editable, prompt-injection-labeled excerpt with a user-selected 4k/8k/16k/32k character budget. PDF/DOCX/XLSX full-text indexing and richer excerpt/summary controls remain future work.
- Live demo: [susan-ai.vercel.app](https://susan-ai.vercel.app/)

## 2. Product direction

পরবর্তী phase-এর মূল লক্ষ্য হবে:

> **“একটি সুন্দর multi-model chat UI” থেকে “বিশ্বাসযোগ্য, measurable, user-controlled AI workspace”-এ উন্নীত করা।**

এজন্য roadmap-এর priority হবে:

1. **Trust ও reliability** — provider failure, retry, timeout, quota এবং long-running task স্পষ্টভাবে handle করা।
2. **Attachment intelligence** — extracted content-কে searchable, reusable এবং privacy-aware করা।
3. **Agent usability** — plan বোঝা, approval দেওয়া, pause/resume এবং ফল যাচাই করা সহজ করা।
4. **Mobile parity** — mobile-এ desktop-এর core capability রাখা, কিন্তু cramped UI না করা।
5. **Production operations** — observability, rate limiting, secret hygiene, rollback এবং support readiness।

## 3. প্রথমে সমাধানযোগ্য UX debt

সাম্প্রতিক desktop ও mobile captures থেকে তিনটি immediate usability issue roadmap-এ আলাদা করে ধরা হয়েছে। Desktop-এ composer-এর inline model control এবং sidebar-এর পুরনো/দ্বিতীয় model affordance যেন একই কাজের জন্য দ্বৈত entry point না দেয়, সেটি একটি canonical interaction-এ নামিয়ে আনতে হবে। Narrow mobile viewport-এ placeholder, model pill, effort selector এবং action icons-এর মধ্যে wrapping বা overlap হলে composer-এর text area একটি stable `min-width` পাবে এবং selector/action row আলাদা layout boundary ব্যবহার করবে। অতিরিক্ত helper copy composer-এর usable height কমিয়ে দিলে mobile-এ তা compact copy বা collapsible help হিসেবে দেখানো হবে।

এই fixes-এর সঙ্গে light/dark theme-এ model status dot, icon contrast, muted text এবং sheet surface একই semantic color token ব্যবহার করবে। অর্থাৎ screenshot polish কেবল spacing change নয়; layout contract, accessibility label এবং responsive browser test একসঙ্গে update করতে হবে।

---

# Phase 0 — Release baseline ও instrumentation

**সময়:** Week 1  
**Priority:** P0  
**Goal:** পরবর্তী feature তৈরির আগে বর্তমান আচরণ measurable এবং reproducible করা।

## Deliverables

### 0.1 Product analytics, privacy-safe

Browser-local বা opt-in event counters যোগ করা হবে; কোনো prompt, API key, extracted document text বা provider response পাঠানো হবে না। Track করা যেতে পারে:

- chat started / message sent / response completed
- provider fallback triggered
- attachment added / extraction completed / OCR failed
- Agent task started / approved / paused / completed / failed
- Settings বা About mobile sheet opened
- PWA install prompt shown / accepted

**Acceptance criteria:**

- Explicit opt-in অথবা local-only counters ছাড়া external analytics নয়।
- Event payload-এ prompt, filename content, key, response text বা document text থাকবে না।
- Analytics disabled থাকলেও মূল app flow কাজ করবে।

### 0.2 Error taxonomy এবং correlation IDs

Provider error, extraction error, Agent tool error এবং client UI error-এর জন্য consistent error code তৈরি করা হবে:

- `PROVIDER_AUTH`
- `PROVIDER_RATE_LIMIT`
- `PROVIDER_TIMEOUT`
- `PROVIDER_MODEL_UNAVAILABLE`
- `ATTACHMENT_UNSUPPORTED`
- `EXTRACTION_FAILED`
- `OCR_FAILED`
- `AGENT_APPROVAL_REQUIRED`
- `AGENT_TOOL_FAILED`

Server-side request-এর জন্য redacted correlation ID থাকবে, যাতে user support বা logs-এ sensitive payload না যায়।

### 0.3 CI quality gate

GitHub Actions PR workflow-এ এই gates চালানো হবে:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run test:mobile
npm run test:e2e:mobile
npm test
npm run build
node scripts/check-audit-policy.mjs
```

Audit policy critical এবং unapproved high-severity findings block করে। বর্তমানে unpatched `braces` advisory শুধু development-only Next ESLint toolchain-এ reachable হওয়ায় exact advisory ও dependency chain-এ সীমিত temporary exception; নতুন বা unrelated high/critical finding fail করবে। Moderate findings report হয়, কিন্তু বর্তমান dependency tree-তে blocking নয়।

**Exit gate:** reproducible green build, no untracked test artifacts, এবং failed E2E হলে screenshot/trace artifact পাওয়া যায়। Local gates pass; follow-up PR-এ hosted Actions run green হওয়া বাকি।

---

# Phase 1 — Unified model gateway ও conversation reliability

**সময়:** Week 2–3  
**Priority:** P0  
**Goal:** model selection, fallback, retry এবং streaming-এর user experience একত্রিত করা।

## Deliverables

### 1.1 Provider capability registry

প্রতিটি provider/model-এর জন্য একটি canonical capability contract:

- text generation
- streaming
- image/file input
- PDF support
- vision support
- max input/output estimate
- response effort support
- local/cloud classification
- authentication requirement

UI, route validation এবং attachment support একই registry ব্যবহার করবে; duplicate capability logic কমাতে হবে।

### 1.2 Explicit request lifecycle

Composer-এ request state স্পষ্ট করা হবে:

`idle → preparing → sending → streaming → completed`

Failure states:

`retryable → retrying → completed` অথবা `blocked → user action required`

UI-তে দেখাতে হবে:

- কোন model ব্যবহার হচ্ছে
- fallback কেন trigger হয়েছে
- retry কতবার হয়েছে
- user চাইলে retry/stop/change model action

### 1.3 Safe automatic fallback

Fallback policy:

- একই request-এ সর্বোচ্চ bounded attempts
- একই model পুনরায় loop করবে না
- authentication/invalid-key failure-এ আগে user action
- rate limit/temporary outage-এ next connected model
- file-capability mismatch হলে file support থাকা model নির্বাচন
- fallback হলে original এবং active model দুটোই user-visible

### 1.4 Conversation recovery

- interrupted stream-এর জন্য retry বা resume affordance
- failed response যেন conversation history-তে misleading success হিসেবে save না হয়
- duplicate submit prevention
- page refresh-এর পর in-flight state recover না হলেও clear status
- user-triggered regeneration-এ original message context preserve

**Acceptance criteria:**

- Provider failure-এর পর user বুঝতে পারবেন কী ঘটেছে এবং কোন model উত্তর দিয়েছে।
- fallback attempt bounded এবং test-covered।
- streaming failure-এ composer input হারাবে না।
- error UI mobile ও desktop উভয় viewport-এ overflow করবে না।

**Metrics:**

- failed request recovery rate
- fallback success rate
- duplicate request rate
- median time to visible error

---

# Phase 2 — Attachment Intelligence 2.0

**সময়:** Week 3–5  
**Priority:** P0  
**Goal:** attachment upload/extraction থেকে একটি reusable, user-controlled document context system তৈরি করা।

## Deliverables

### 2.1 Document intelligence pipeline

প্রতিটি attachment-এর lifecycle:

`selected → validated → extracted → indexed → ready for context`

Source metadata রাখা হবে:

- file type/category
- extraction source: text layer / PDF text / OCR
- OCR language
- character count
- extraction confidence/status
- created timestamp
- local document ID

### 2.2 Local search এবং document reuse

Browser-local document library-তে:

- filename এবং extracted text search
- tag/category filter
- recent documents
- “Use in chat” action
- “Send to Agent” action
- delete এবং clear-all confirmation
- re-run OCR/extraction

**Privacy boundary:** extracted content external provider-এ কেবল user send করলে যাবে; indexing browser-local থাকবে।

### 2.3 Context budget controls

User-facing controls:

- Include full text
- Include summary only
- Include selected excerpt
- Exclude from next message
- Context character/token estimate

System safeguards:

- per-file এবং total context budget
- truncation হলে visible notice
- prompt injection-এর জন্য extracted text untrusted context হিসেবে label
- text এবং binary file parts-এর duplication prevention

### 2.4 OCR quality improvements

- Bengali + English default presets-এর পাশাপাশি language selection validation
- page-level OCR progress
- scanned PDF-এর page count এবং failed page list
- large PDF-এ configurable page limit
- OCR worker cleanup এবং cancellation
- OCR result preview-এর সঙ্গে confidence বা “verify text” warning

**Acceptance criteria:**

- user জানবেন কোন text provider-এ পাঠানো হবে।
- extraction failure-এ original file হারাবে না।
- large/bad PDF browser freeze করবে না।
- file replacement করলে পুরনো extraction/context state clean হবে।

**Metrics:**

- extraction completion rate
- OCR failure rate by file type/language
- median extraction time
- average context reuse rate
- user-triggered retry rate

---

# Phase 3 — Agent Workspace 2.0

**সময়:** Week 5–7  
**Priority:** P0  
**Goal:** Agent Mode-কে “task run” থেকে একটি inspectable, controllable workspace-এ পরিণত করা।

## Deliverables

### 3.1 Plan-first task flow

প্রতিটি Agent task-এ:

1. Goal summary
2. Proposed steps
3. Required files/tools
4. Risk level
5. Approval points
6. Expected outputs

User actions:

- Approve all safe steps
- Approve one step
- Edit goal
- Reject step
- Pause task
- Resume task
- Cancel task

### 3.2 Execution timeline ও tool transparency

Timeline item-এ দেখাতে হবে:

- step name
- status
- start/end time
- tool used
- input summary (redacted)
- output artifact
- failure reason
- retry option

### 3.3 Generated files workspace

Generated PDF/DOCX/XLSX output-এর জন্য:

- preview metadata
- ready/failed state
- file size
- download button
- regenerate button
- delete button
- output provenance: কোন input document এবং কোন task থেকে তৈরি

### 3.4 Approval এবং external action safety

Future external actions-এর আগে explicit approval boundary:

- sending email
- public publishing
- changing account settings
- writing to external systems
- destructive file operation

Safe local actions যেমন local analysis, draft generation এবং preview-এর জন্য unnecessary confirmation নয়।

**Acceptance criteria:**

- task কোথায় আটকে আছে user বুঝতে পারবেন।
- failed tool step পুরো task state নষ্ট করবে না।
- refresh বা navigation-এর পর task history পাওয়া যাবে।
- approval modal mobile-এ usable এবং keyboard-accessible।

**Metrics:**

- task completion rate
- approval abandonment rate
- tool retry success rate
- time to first useful output
- generated-file download rate

---

# Phase 4 — Mobile parity ও interaction polish

**সময়:** Week 6–8  
**Priority:** P1  
**Goal:** mobile UI-কে শুধু responsive নয়, task-complete এবং comfortable করা।

## Deliverables

### 4.1 Mobile navigation model

- sidebar open/close এবং back navigation consistency
- active workspace state visible
- bottom-sheet বা full-screen sheet pattern standardise
- Settings, About, Agent approval এবং attachment preview-এর একই close/escape behavior
- keyboard open হলে composer যেন obscured না হয়

### 4.2 Composer usability

Current mobile screenshot-ভিত্তিক polish:

- model selector-এ model name truncate হলেও provider/model distinction বোঝা যাবে
- effort selector এবং model selector overlap করবে না
- attachment, mic, voice এবং send controls minimum touch target বজায় রাখবে
- helper copy configurable বা compact হবে; excessive instructional text composer-এর height বাড়াবে না
- empty state থেকে first message পর্যন্ত visible action path ছোট করা

### 4.3 Accessibility

- keyboard focus order
- focus trap in modal
- screen-reader labels for icon-only buttons
- `aria-live` for streaming/fallback status
- contrast checks in light/dark theme
- reduced motion support
- touch target audit

### 4.4 Visual regression

Playwright screenshot snapshots যোগ করা যেতে পারে:

- 360 × 800 narrow Android
- 390 × 844 iPhone-like viewport
- 768 × 1024 tablet
- 1280 × 800 desktop

কেবল stable surfaces snapshot করা হবে; dynamic model/status text mask করা হবে।

**Acceptance criteria:**

- core actions 360px width-এ horizontal scroll ছাড়াই usable।
- Settings/About/approval/preview sheets safe-area এবং keyboard-এর সঙ্গে কাজ করবে।
- mobile E2E suite CI-তে deterministic হবে।

---

# Phase 5 — Production operations ও trust layer

**সময়:** Week 8–10  
**Priority:** P1  
**Goal:** public deployment-এর জন্য observability, resilience এবং support readiness নিশ্চিত করা।

## Deliverables

### 5.1 Observability

- redacted structured logs
- request correlation ID
- provider latency এবং status metrics
- extraction/OCR duration metrics
- Agent task outcome metrics
- health endpoint-এ dependency status আলাদা করা

### 5.2 Error monitoring

Sentry বা সমতুল্য service ব্যবহার করলে:

- key, prompt, file content, token এবং response text scrub
- environment এবং release tag include
- source maps protected
- alert threshold define

### 5.3 Rate limiting ও abuse controls

Production deployment-এ Upstash বা equivalent shared limiter mandatory করা:

- per-IP বা trusted proxy identity
- route-specific limits
- retry-after handling
- fail-closed behavior documented
- health endpoint rate limit policy আলাদা

### 5.4 Backup/export এবং recovery

- conversation export/import documentation
- Knowledge Base export
- Projects export
- local document backup guidance
- browser data clear warning
- schema versioning এবং migration tests

### 5.5 Release process

- semantic versioning
- changelog
- release checklist
- rollback target
- Vercel deployment verification
- Windows installer verification on Windows runner
- smoke test against production URL

**Exit gate:**

- HTTPS/domain verified
- health monitoring active
- secrets configured outside repository
- backup/export flow tested
- rollback documented
- support contact এবং issue template ready

---

# Phase 6 — Optional collaboration এবং account layer

**সময়:** Week 10+  
**Priority:** P2 / discovery first  
**Goal:** local-first privacy model বজায় রেখে optional sync বা collaboration-এর প্রয়োজন validate করা।

এটি সরাসরি build না করে আগে discovery করা উচিত। সম্ভাব্য scope:

- optional Google sign-in
- encrypted cloud sync
- multi-device conversation sync
- project sharing
- team/provider policy
- server-side document storage

## Guardrails

- local-first mode থাকবে
- sync opt-in হবে
- user স্পষ্টভাবে জানবেন কোন data sync হচ্ছে
- API keys কখনো defaultভাবে sync হবে না
- account ছাড়া core chat ব্যবহার বন্ধ হবে না
- threat model এবং encryption design আগে review করতে হবে

**Go/no-go signals:**

- repeat users multi-device sync চাচ্ছেন কি না
- local storage loss নিয়ে support issue হচ্ছে কি না
- collaboration use case-এর জন্য concrete user demand আছে কি না
- privacy trade-off গ্রহণযোগ্য কি না

---

# Prioritised backlog

| Priority | Item | Phase | Definition of done |
|---|---|---:|---|
| P0 | Unified provider capability registry | 1 | Route, composer ও settings একই capability source ব্যবহার করে |
| P0 | Bounded fallback/retry lifecycle | 1 | Retry loop নেই, state visible, failure tests আছে |
| P0 | Document indexing and local search | 2 | Extracted text browser-local search করা যায় |
| P0 | Context budget and injection-safe attachment context | 2 | Truncation, include/exclude এবং untrusted labels visible |
| P0 | Agent pause/resume/approval timeline | 3 | Task navigation/refresh-এর পর state recoverable |
| P1 | Mobile composer interaction polish | 4 | 360px viewport-এ no-overflow এবং usable controls |
| P1 | Visual regression snapshots | 4 | CI baseline এবং intentional update workflow আছে |
| P1 | Redacted observability | 5 | Logs/metrics-এ secrets বা user content নেই |
| P1 | Production rate-limit and rollback checklist | 5 | Public deployment gate documented and tested |
| P2 | Optional account/sync discovery | 6 | User evidence এবং privacy design ছাড়া implementation নয় |

# Recommended implementation order

## Sprint A — Reliability foundation

1. Capability registry
2. Request lifecycle state machine
3. Fallback/retry contract tests
4. Redacted error/correlation IDs
5. CI command consolidation

## Sprint B — Attachments as local knowledge

1. Document index schema
2. Local search/filter
3. Context budget UI
4. OCR cancellation and page-level progress
5. Attachment-to-Agent handoff

## Sprint C — Agent control

1. Plan review card
2. Approval state machine
3. Pause/resume persistence
4. Tool timeline
5. Generated-file provenance

## Sprint D — Mobile and release hardening

1. Composer polish
2. Modal focus/keyboard audit
3. Visual snapshots
4. Production observability
5. Release candidate checklist

# Definition of Done — প্রতিটি feature-এর জন্য

প্রতিটি roadmap item complete বলতে শুধু UI তৈরি বোঝাবে না। Feature complete হবে যখন:

- product behavior documented
- desktop এবং mobile layout verified
- keyboard এবং screen-reader semantics checked
- success, loading, empty এবং failure state আছে
- sensitive data logging বা network boundary review করা হয়েছে
- unit/contract test আছে
- mobile E2E impact থাকলে browser smoke test আছে
- lint, TypeScript, full test এবং build pass করেছে
- README বা relevant docs update হয়েছে
- Vercel preview বা production smoke check সম্পন্ন হয়েছে

# প্রধান ঝুঁকি ও mitigation

| ঝুঁকি | সম্ভাব্য প্রভাব | Mitigation |
|---|---|---|
| Provider API/model পরিবর্তন | Chat/fallback ভেঙে যেতে পারে | Capability registry, contract tests, opt-in live tests |
| Browser memory pressure | OCR/large files-এ tab freeze | File/page limits, worker cleanup, cancellation, progress |
| Local-only data loss | User history হারাতে পারে | Export reminders, versioned schemas, backup guidance |
| Mobile UI complexity | Small viewport-এ control collision | E2E viewports, visual snapshots, single sheet pattern |
| Agent tool failure | Task অসম্পূর্ণ বা misleading output | Step-level status, retry, approval, provenance |
| Sensitive logging | Privacy/security incident | Redaction tests, no raw prompt/file logging, secret audit |
| Feature sprawl | Core chat দুর্বল হয়ে যাওয়া | P0/P1/P2 gate, discovery before account/sync |

# Success dashboard

প্রতি release candidate-এ অন্তত এই metrics review করা উচিত:

- chat completion এবং provider fallback success rate
- median first-token latency
- retryable error recovery rate
- attachment extraction/OCR success rate
- average OCR duration এবং cancellation rate
- Agent task completion rate
- generated-file failure rate
- mobile E2E pass rate
- production health endpoint availability
- support issue categories

**Strategic checkpoint:** Phase 3 শেষ হওয়ার পর user feedback review করে Phase 4–6-এর scope পুনরায় prioritise করা হবে। Account/sync build করার আগে attachment intelligence, Agent reliability এবং production safety measurableভাবে stable হওয়া উচিত।
