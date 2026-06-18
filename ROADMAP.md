# Roadmap — pi-localgpt

This roadmap tracks the current state of `pi-localgpt` and lists bounded
maintenance seeds for the weekly maintenance planner. It is written to match
the **current unified MCP bridge architecture** (stable since `v0.3.0`); the
pre-`v0.3.0` direct-filesystem memory access pattern has been removed and is
not a target for future work.

> Scope note: this file is a living planning document, not a release contract.
> Seed items are intentionally small (30–90 minutes each). Promote a seed into
> a tracked issue when you intend to work on it, then mark it ✅ here.

---

## 1. Current state

| Area | Status |
|---|---|
| Latest release | **`v0.4.2`** (npm Trusted Publishing, tag `v0.4.2`) |
| Architecture | Unified **1-shot MCP bridge** — each tool spawns `localgpt-gen mcp-server --connect`, sends one request, exits. No persistent process. |
| Tool surface | `localgpt_gen_status` + `localgpt_gen_call` (generic) + **49 unique curated wrappers** + 4 backward-compatible `localgpt_memory_*` legacy aliases |
| Design log | 4 `localgpt_design_log_*` tools, all routed through the bridge (`memory_search`/`_get`/`_save`/`_log`) |
| Code health | `npm run typecheck` clean; **51 tests pass** (`node:test`); strict TypeScript (`ES2022`, `NodeNext`) |
| CI/Release | Node 24 on `ci.yml` + `publish.yml`; auto-release + Trusted Publishing (no `NPM_TOKEN`) |
| Skills | `skills/localgpt-gen/SKILL.md` (workflow guide) |

### Release history (architecture-relevant)

- **`v0.1.0`** — Direct filesystem memory access. **Removed in `v0.3.0`.**
- **`v0.2.0`** — Gen MCP 1-shot bridge + first 27 curated gen tools.
- **`v0.3.0`** — **Breaking pivot:** removed v1 filesystem tools; unified all
  memory + gen tools onto the 1-shot MCP bridge.
- **`v0.4.0`** — Game-mechanics wrappers (player, NPC, triggers, physics,
  terrain, audio); reached ~50 curated tools.
- **`v0.4.1`** — Removed stale memory wording from README.
- **`v0.4.2`** — Renamed "memory" → "design log" user-facing wording; added
  backward-compatible `localgpt_memory_*` aliases; added local workspace helper
  libraries (`localgpt-config.ts`, `localgpt-workspace.ts`, `design-log-*.ts`).

---

## 2. Themes for the next 2–3 releases

These themes guide which seeds to promote each week. They are deliberately
**post-pivot**: every item assumes the unified MCP bridge is the architecture.

- **Theme A — Finish the design-log rename.** The `v0.4.2` rename left behind
  legacy aliases (no removal date) and a set of local libraries that are not
  wired to any tool. Close that loop.
- **Theme B — Robustness of the 1-shot bridge.** The client works but is thin
  on diagnostics (no stderr capture, hard-coded timeout) and on failure-path
  test coverage. These are the modes users actually hit.
- **Theme C — Docs accuracy & tool-surface truth.** Headline tool counts and
  README claims drift from the code; make the docs self-checking.
- **Theme D — Dependency hygiene.** Resolve or explicitly accept the current
  `npm audit` advisories and document blast radius (shipped vs dev).

### Tentative release mapping

- **`v0.5.0`** — Theme A + C: complete the design-log rename decision and a
  docs accuracy pass.
- **`v0.6.0`** — Theme B: bridge robustness (stderr, timeout, failure tests).
- **`v0.7.0`** — Theme D + polish: dependency review, examples, i18n.

---

## 3. Candidate maintenance seeds

Each seed is bounded to **30–90 minutes** and written so the weekly planner can
promote it directly into an issue. Format: **What / Why / Acceptance / Theme /
Estimate**.

### 🌱 Seed 1 — Decide the fate of the unwired local design-log libraries

- **What:** `lib/design-log-read.ts`, `lib/design-log-search.ts`, and
  `lib/design-log-write.ts` were added in `v0.4.2` and are covered by
  `tests/design-log-libraries.test.mjs`, but **no tool imports them**. Every
  `localgpt_design_log_*` tool routes through the MCP bridge
  (`memory_search`/`_get`/`_save`/`_log`) instead. Pick one and implement it:
  (a) wire the libraries as an **offline fallback** so design-log search/save
  works when `localgpt-gen` is not running, (b) **remove** them as dead code
  (plus their tests), or (c) **document** them as a reference/testing utility
  only.
- **Why:** ~250 lines of lib + 213 lines of tests sit unused by production
  tools, which obscures the real data path and misleads future maintainers.
- **Acceptance:** A documented decision (ROADMAP/README note). If wired: an
  integration test proving offline search works without the binary. If removed:
  files and their tests deleted, smoke test still passes.
- **Theme:** A · **Estimate:** 45–75 min

### 🌱 Seed 2 — Reconcile the "50 curated tools" count

- **What:** The README headline and `package.json` description claim
  "50 curated tools". The actual count is **49 unique curated wrappers**
  (or 53 incl. the 4 legacy `localgpt_memory_*` aliases; or 51 total incl.
  `localgpt_gen_status` + `localgpt_gen_call`). Choose one canonical
  definition and make README, `package.json` description, and the tools table
  agree.
- **Why:** Inaccurate counts erode trust and hide tool-coverage gaps.
- **Acceptance:** One authoritative count statement; numbers match across
  `README.md`, `package.json` `description`, and the tools section. Optionally
  add a tiny `scripts/` check that counts registered tools.
- **Theme:** C · **Estimate:** 20–40 min

### 🌱 Seed 3 — Set a deprecation timeline for `localgpt_memory_*` aliases

- **What:** `v0.4.2` added backward-compatible `localgpt_memory_*` aliases with
  no removal target. Define a policy (e.g., document a removal version such as
  `v0.6.0`) and add a deprecation signal — at minimum a one-time console hint
  on first use, or a clear note in tool descriptions.
- **Why:** Aliases without an end date accumulate forever; a clear path lets the
  rename to "design log" actually complete.
- **Acceptance:** Deprecation note in `CHANGELOG.md` + `README.md`; removal
  version recorded in this ROADMAP; optional runtime hint with a test.
- **Theme:** A · **Estimate:** 30–60 min

### 🌱 Seed 4 — Capture stderr in the 1-shot MCP client

- **What:** `lib/gen-mcp-client.ts` opens `stdio: ["pipe","pipe","pipe"]` but
  **never reads `stderr`**. On spawn failure or MCP error the user sees only a
  generic message. Buffer stderr and append a trimmed excerpt to thrown errors.
- **Why:** `localgpt-gen` failures are hard to debug today; stderr usually
  carries the real cause (e.g., "relay port 9878 in use", protocol mismatch,
  missing Bevy window).
- **Acceptance:** Error path includes a stderr excerpt when stderr is non-empty;
  a new test exercises a mock child that writes to stderr then errors.
- **Theme:** B · **Estimate:** 45–75 min

### 🌱 Seed 5 — Make the 1-shot client timeout configurable per tool

- **What:** The bridge hard-codes a 30s timeout (`DEFAULT_TIMEOUT_MS`). The
  option already exists on `GenCallOptions.timeoutMs` but curated wrappers and
  `localgpt_gen_call` only forward `signal`. Surface `timeoutMs` (or an env
  override like `LOCALGPT_GEN_TIMEOUT_MS`) on `localgpt_gen_call` and the
  long-running wrappers (`gen_refine`, `gen_apply_blockout`, `gen_regenerate`).
- **Why:** 30s is brittle for AI-driven evaluate/refine loops; users hit an
  opaque "Timed out waiting for MCP response" with no knob.
- **Acceptance:** `localgpt_gen_call` + flagged long-running wrappers accept and
  forward a timeout; a test proves the override is respected end-to-end.
- **Theme:** B · **Estimate:** 30–60 min

### 🌱 Seed 6 — Add failure-path tests for the 1-shot client

- **What:** `tests/gen-tools.test.mjs` mocks the happy path but the client's
  **abort** and **timeout** branches in `waitForResponse`/`cleanup` have no
  direct coverage. Add focused tests: abort mid-handshake, timeout expiry, and
  MCP error response.
- **Why:** These are the failure modes users hit; they are currently untested.
- **Acceptance:** New tests added and passing; abort, timeout, and MCP-error
  paths each covered.
- **Theme:** B · **Estimate:** 30–60 min

### 🌱 Seed 7 — Triage transitive dependency advisories

- **What:** `npm audit` reports **3 high-severity advisories** (`protobufjs`
  DoS ×2, `ws` DoS ×1), all via the `@earendil-works/pi-coding-agent`
  transitive tree. Determine blast radius (these are dev/build deps, **not
  shipped** to npm consumers since `files:` excludes `node_modules`), decide
  whether `npm audit fix` is safe, and record the decision.
- **Why:** Security hygiene + clarity for downstream consumers.
- **Acceptance:** Documented assessment (shipped vs dev) in a comment or
  `SECURITY.md` note; safe fix applied or explicitly accepted with rationale.
- **Theme:** D · **Estimate:** 20–40 min

### Backlog seeds (lower priority / needs maintainer input)

- 🌱 **Bilingual or English SKILL.md summary.** `skills/localgpt-gen/SKILL.md`
  is Japanese-only while all other docs are English. Add an English summary or
  confirm the Japanese-only choice is intentional. *(Theme C, ~30–45 min —
  confirm intent before doing.)*
- 🌱 **Offline design-log `localgpt_gen_status` hint.** When the bridge is
  unreachable, `gen-status` could point users at whether the local design-log
  fallback (see Seed 1) is available. Depends on Seed 1's decision.
- 🌱 **Examples directory.** Add `examples/` with one end-to-end WorldGen
  pipeline transcript (plan → blockout → populate → evaluate → refine) to help
  new users. *(Theme C, ~45–60 min.)*

---

## 4. Triaged / out of scope

- **Pre-`v0.3.0` direct filesystem memory access** — intentionally removed; do
  not restore. Any imported issue referencing `localgpt:search`,
  `localgpt:remember`, `localgpt:init`, or `lib/memory-*.ts` predates the pivot
  and should be re-scoped or closed against the current bridge architecture.
- **`DOT-207` (backlog, imported)** — originates from a pre-pivot import and is
  unlikely to reflect the unified MCP bridge. **Validate against the current
  codebase before referencing or acting on it**; re-scope or close if it
  assumes the removed filesystem pattern.

---

## 5. How to use this roadmap

1. The weekly maintenance seed planner reads **Section 3** and promotes 1–3
   seeds into issues per week.
2. When a seed is completed, mark it ✅ with the PR/issue link and move it under
   the relevant release in **Section 2**.
3. Keep release versions and the "Current state" table in sync with
   `package.json` / `CHANGELOG.md` after each release.
4. Add new seeds under Section 3 as debt is discovered; retire stale ones into
   Section 4.
