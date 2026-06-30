---
name: localgpt-memory
description: LocalGPT 設計ログ／メモリを Pi から操作。cross-session 設定・ワールド構築意図・長期アシスタントコンテキストの記録と検索。ユーザーが「前に言った設定」「前回のデザイン判断」「ワールド構築の意図」に言及した時に活用。
---

# LocalGPT Memory

`pi-localgpt` の LocalGPT メモリ（設計ログ）ツール群は、**cross-session で持続する設計意図・設定・コンテキスト**を記録・検索するためのインターフェース。

全メモリ操作は `localgpt-gen mcp-server --connect` の **1-shot CLI** 経由（常駐プロセスなし）。詳細は [`skills/localgpt-gen/SKILL.md`](../localgpt-gen/SKILL.md) を参照。

> **Python RAG 版「LocalGPT」（langchain ベースのローカル RAG）とは無関係。** 本パッケージは [localgpt.app](https://localgpt.app/) の **LocalGPT Gen**（Bevy エンジン 3D ワールド構築ツール）のメモリ機能を操作する。

## いつ使うか

| 状況 | 使うもの |
|------|----------|
| 前回のセッションで決めた設計方針・テーマを思い出したい | `localgpt_design_log_search` または `localgpt_memory_search` |
| 過去のワールド構築で試した設定・好みを確認したい | `localgpt_design_log_search` または `localgpt_memory_search` |
| 検索結果の内容をもっと詳しく読みたい | `localgpt_memory_get` |
| 長期間保持すべき設計判断・好みを保存したい | `localgpt_design_log_save` |
| 今日の作業ログに簡単なメモを追記したい | `localgpt_design_log_log` |
| ワールド構築の設計意図（plan/evaluate/export への参照付き）を保存したい | `localgpt_remember_worldgen` |
| vault qmd 内のプロジェクトメモ・設計ドキュメントを参照したい | vault qmd（本 skill の対象外） |
| gen / vault との双方向同期が必要な高度なユースケース | **将来検討** — 詳細は [backlog-deferred](https://github.com/eiei114/pi-localgpt/blob/main/docs/backlog-deferred.md) 参照 |

### LocalGPT memory vs vault qmd の使い分け

| 側面 | LocalGPT memory（設計ログ） | vault qmd（プロジェクトメモ） |
|------|----------------------------|------------------------------|
| 用途 | cross-session 設計意図・設定プレファレンス・簡易メモ | 設計ドキュメント・PRD・仕様・長期的ナレッジ |
| 更新頻度 | 高（毎セッション） | 低（設計完了時・レビュー時） |
| 検索方法 | `localgpt_memory_search`（semantic + keyword） | vault 検索 / 手動参照 |
| 検索範囲 | LocalGPT workspace 内の DESIGN-LOG.md + daily logs | vault 全体の .qmd / .md |
| Pi からの操作 | 全ツール・コマンドから直接アクセス可能 | 外部（本 skill の対象外） |
| 双方向 sync | なし（将来検討） | なし（将来検討） |

## 前提

1. `localgpt-gen` がインストール済み（`cargo install localgpt-gen`）
2. **localgpt-gen がインタラクティブモードで起動中**（Bevy 窓あり）— `--connect` リレーがこれに接続する
3. LocalGPT workspace が設定済み（`localgpt config init` または `LOCALGPT_WORKSPACE` 環境変数）
4. 初回利用前に `localgpt_status` で workspace 準備状態を確認推奨

## ツール一覧（MVP）

### Status（到達性確認）

| 状況 | Tool |
|------|------|
| LocalGPT workspace（DESIGN-LOG.md / daily log）の準備状態確認 | `localgpt_status` |
| localgpt-gen binary + relay 到達性確認 | `localgpt_gen_status` |

### Search & Read（検索・読み取り）

| 状況 | Tool |
|------|------|
| 設計ログを semantic + keyword 検索 | `localgpt_design_log_search`（推奨）または `localgpt_memory_search` |
| 検索結果の行範囲を path + startLine/endLine で読む | `localgpt_memory_get` |
| 検索結果の ID でエントリ詳細を読む | `localgpt_design_log_get` |

### Write（書き込み）

| 状況 | Tool |
|------|------|
| 長期設計ログ（cross-session 設定・好み）を保存 | `localgpt_design_log_save`（推奨）または `localgpt_memory_save` |
| 日次ログ（タイムスタンプ付きメモ）に追記 | `localgpt_design_log_log`（推奨）または `localgpt_memory_log` |
| ワールド構築の設計意図（plan/evaluate/export/world 参照付き）を保存 | `localgpt_remember_worldgen` |

### レガシーエイリアス

| 現行名 | エイリアス | 状態 |
|--------|-----------|------|
| `localgpt_design_log_save` | `localgpt_memory_save` | 後方互換あり（将来削除予定） |
| `localgpt_design_log_log` | `localgpt_memory_log` | 後方互換あり（将来削除予定） |
| `localgpt_design_log_search` | `localgpt_memory_search` | 後方互換あり |

> `localgpt_memory_search` と `localgpt_memory_get` は独自のファイルシステム フォールバック実装を持ち、binary なしでも keyword 検索・行範囲読み取りが可能な独立ツールとして設計されている。

## コマンド一覧（MVP）

| コマンド | 動作 |
|----------|------|
| `/localgpt:status` | LocalGPT workspace 準備状態を確認（binary spawn 不要） |
| `/localgpt:gen-status` | localgpt-gen binary + relay 到達性を確認 |
| `/localgpt:search` | 対話的プロンプトで memory 検索（`localgpt_memory_search` を呼ぶ） |
| `/localgpt:get` | パス + 行範囲を指定してメモリ読み取り（`localgpt_memory_get` を呼ぶ） |
| `/localgpt:remember` | 対話的プロンプトで DESIGN-LOG.md に追記（`localgpt_design_log_save` を呼ぶ） |
| `/localgpt:remember-worldgen` | ワールド構築 rationale を保存（`localgpt_remember_worldgen` を呼ぶ） |

## 推奨フロー

```
# 1. 到達性確認（初回）
localgpt_status → workspace 準備状態の確認
localgpt_gen_status → binary + relay の確認（必要な場合）

# 2. セッション開始時に過去の設定・判断を確認
localgpt_design_log_search(query="前回のテーマ配色や照明設定")
  ↓ スニペット不足なら
localgpt_memory_get(path="DESIGN-LOG.md", startLine=10, endLine=30)
  ↓ entry ID があれば
localgpt_design_log_get(id="...")

# 3. 設計判断・好みを長期保存
localgpt_design_log_save(content="Level 2 のテーマは abandoned factory。照明は warm tint、曇り空。")
  ↓ 日次メモも併用
localgpt_design_log_log(content="今日は harbor chokepoint の blockout を試行。lighthouse を唯一の安全ルートに。")

# 4. ワールド構築後の設計意図保存（worldgen 連携）
localgpt_remember_worldgen(
  rationale="Harbor chokepoint: warehouse_row は intentionally low cover",
  references={plan: ..., evaluate: ..., export: ...}
)

# 5. 次回セッション
localgpt_design_log_search(query="abandoned factory warm tint")
```

## 制約

- **メモリは 1-shot MCP bridge 経由** — 各 tool call で `localgpt-gen mcp-server --connect` が spawn される。localgpt-gen の Bevy 窓が起動していないと全ツールが失敗
- **`localgpt_status` は binary spawn 不要** — 設定ファイルと workspace ファイルを直接読み取る keyword モード
- **Python RAG LocalGPT とは無関係** — 詳細は README 参照
- **vault qmd との双方向 sync は未実装** — 高度な vault 連携は [backlog-deferred](https://github.com/eiei114/pi-localgpt/blob/main/docs/backlog-deferred.md) で将来検討

## 参考リンク

- [`skills/localgpt-gen/SKILL.md`](../localgpt-gen/SKILL.md) — Gen 3D ワールド構築 skill（全 gen tool + pipeline）
- [`docs/memory-worldgen-save.md`](../../docs/memory-worldgen-save.md) — worldgen 設計意図保存の詳細
- [`docs/backlog-deferred.md`](../../docs/backlog-deferred.md) — gen / vault 連携の将来計画
- [README.md](../../README.md) — パッケージ概要・インストール
