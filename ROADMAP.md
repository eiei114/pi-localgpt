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
| Latest release | **`v0.10.3`** (`package.json`; npm tag pending until publish workflow runs) |
| Architecture | Unified **1-shot MCP bridge** — each tool spawns `localgpt-gen mcp-server --connect`, sends one request, exits. No persistent process. |
| Tool surface | **51 curated gen wrappers** (canonical `genToolMeta` count; excludes `localgpt_design_log_*` and legacy `localgpt_memory_save`/`localgpt_memory_log`) + `localgpt_gen_call` + design-log / vault / worldgen helpers |
| Design log | 4 `localgpt_design_log_*` tools on the bridge (`memory_search`/`_get`/`_save`/`_log`); `localgpt_memory_search`/`_get` read aliases; `localgpt_memory_save`/`_log` write aliases |
| Code health | `npm run typecheck` clean; **194 `node:test` cases** pass; strict TypeScript (`ES2022`, `NodeNext`) |
| CI/Release | Node 24 on `ci.yml` + `publish.yml` (`actions/checkout@v7`, `setup-node@v6`); auto-release + Trusted Publishing (no `NPM_TOKEN`) |
| Skills | `skills/localgpt-gen/SKILL.md` + `skills/localgpt-memory/SKILL.md` |

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
  libraries (`localgpt-config.ts`, `localgpt-workspace.ts`).

---

## 2. Themes for the next 2–3 releases

These themes guide which seeds to promote each week. They are deliberately
**post-pivot**: every item assumes the unified MCP bridge is the architecture.

- **Theme A — Finish the design-log rename.** The `v0.4.2` rename left behind
  legacy aliases (no removal date). Close that loop.
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

### ✅ Seed 1 — Decide the fate of the unwired local design-log libraries (DOT-1240)

- **Decision (2026-07-28):** **Remove** the unused `lib/design-log-*.ts`
  modules. All `localgpt_design_log_*` tools stay on the unified 1-shot MCP
  bridge (`memory_search`/`_get`/`_save`/`_log`). Offline filesystem fallback
  is out of scope — it would reintroduce the pre-`v0.3.0` direct-access path
  this project intentionally removed.
- **Kept:** `localgpt-config.ts` and `localgpt-workspace.ts` (used by
  `localgpt_status`, vault exports, and path guards).
- **PR:** DOT-1240

### ✅ Seed 2 — Reconcile the curated tools count (DOT-941 / DOT-1197)

- **Done:** Canonical count is **51 curated gen wrappers** (`scripts/count-curated-tools.mjs` +
  `npm run metadata:check`). README, `package.json`, `skills/localgpt-gen/SKILL.md`, and
  `tests/package-metadata.test.mjs` enforce the same number.

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

### ✅ Seed 4 — Capture stderr in the 1-shot MCP client (DOT-1245)

- **Done:** Failed bridge calls append a sanitized stderr excerpt; regression tests in
  `tests/gen-tools.test.mjs` cover initialize, tools/list, timeout, and empty-stderr paths.

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

### ✅ Seed 6 — Add failure-path tests for the 1-shot client (DOT-1245)

- **Done:** `tests/gen-tools.test.mjs` covers MCP initialize errors, tools/list errors,
  tools/call timeout (with pre-timeout stderr), and empty-stderr failures.

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
  unreachable, `gen-status` could point users at setup steps for the MCP bridge.
  *(Depends on localgpt-gen relay; no local filesystem fallback planned.)*
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
