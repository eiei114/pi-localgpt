---
name: localgpt-gen
description: LocalGPT Gen 3Dワールド構築を Pi から操作。1-shot CLI でシーン生成・WorldGen pipeline・エクスポート。ユーザーが「3Dシーン」「ワールド構築」「レベルデザイン」「blockout」「LocalGPT Gen」に言及した時に活用。
---

# LocalGPT Gen

[LocalGPT Gen](https://localgpt.app/docs/gen/) は Bevy エンジンによるリアルタイム3Dレベルデザインツール。`pi-localgpt` は `localgpt-gen mcp-server --connect` を **1ショット spawn** で呼び出し、常駐プロセスを作らない。

## 前提

1. `localgpt-gen` がインストール済み（`cargo install localgpt-gen`）
2. **localgpt-gen がインタラクティブモードで起動中**（Bevy 窓あり）— `--connect` リレーがこれに接続する
3. 利用前に `localgpt_gen_status` で binary + relay を確認

## ツールカテゴリ

### Design log

| 状況 | Tool |
|------|------|
| 過去の設計ログを検索 | `localgpt_design_log_search` または `localgpt_memory_search` |
| 検索結果の行範囲を読む | `localgpt_memory_get`（`path` + `startLine`/`endLine`） |
| 検索結果 ID で詳細を読む | `localgpt_design_log_get` |
| 長期設計ログとして保存 | `localgpt_design_log_save` |
| 日次ログに追記 | `localgpt_design_log_log` |

### 汎用

| 状況 | Tool |
|------|------|
| 到達性確認 | `localgpt_gen_status` または `/localgpt:gen-status` |
| 未ラップの gen tool | `localgpt_gen_call`（tool 名 + args を直接指定） |

### Player & NPC

| 状況 | Tool |
|------|------|
| プレイヤー配置 | `localgpt_gen_spawn_player` |
| NPC 作成 | `localgpt_gen_add_npc` |
| NPC 会話設定 | `localgpt_gen_npc_dialogue` |

### Interactions

| 状況 | Tool |
|------|------|
| トリガー追加 | `localgpt_gen_add_trigger` |
| テレポーター | `localgpt_gen_add_teleporter` |
| 収集アイテム | `localgpt_gen_add_collectible` |
| ドア追加 | `localgpt_gen_add_door` |

### Physics

| 状況 | Tool |
|------|------|
| 物理設定 | `localgpt_gen_set_physics` |
| コライダー追加 | `localgpt_gen_add_collider` |
| 力・衝撃 | `localgpt_gen_add_force` |
| 重力設定 | `localgpt_gen_set_gravity` |

### Terrain & Sky

| 状況 | Tool |
|------|------|
| 地形生成 | `localgpt_gen_add_terrain` |
| 水面追加 | `localgpt_gen_add_water` |
| 植生散布 | `localgpt_gen_add_foliage` |
| 空・大気設定 | `localgpt_gen_set_sky` |

### Audio

| 状況 | Tool |
|------|------|
| 環境音 | `localgpt_gen_set_ambience` |
| 音源配置 | `localgpt_gen_audio_emitter` |

### シーン操作

| 状況 | Tool |
|------|------|
| シーン全体を確認 | `localgpt_gen_scene` |
| エンティティ詳細 | `localgpt_gen_entity` |
| スクリーンショット | `localgpt_gen_screenshot` |
| プリミティブ配置 | `localgpt_gen_spawn` / `localgpt_gen_spawn_batch` |
| エンティティ変更 | `localgpt_gen_modify` / `localgpt_gen_delete` |
| カメラ・ライト・環境 | `localgpt_gen_camera` / `localgpt_gen_light` / `localgpt_gen_environment` |
| Undo / Redo | `localgpt_gen_undo` / `localgpt_gen_redo` |
| クリア | `localgpt_gen_clear` |

### WorldGen pipeline（推奨フロー）

テキスト記述から構造化ワールドを構築するパイプライン:

```
localgpt_gen_plan_from_roblox_trend → Roblox トレンド要約を整形して BlockoutSpec JSON
localgpt_gen_plan_from_note  → vault メモを整形して BlockoutSpec JSON
localgpt_gen_plan              → 短いテキストから BlockoutSpec JSON
localgpt_gen_blockout          → 地形 + リージョン + パス
localgpt_gen_navmesh       → 歩行可能グリッド（任意）
localgpt_gen_populate      → hero / medium / decorative 配置
localgpt_gen_evaluate      → 注釈付きスクリーンショットで自己評価
localgpt_gen_refine        → 自動 evaluate → adjust ループ
localgpt_gen_modify_blockout → リージョンの追加・移動・リサイズ
localgpt_gen_regenerate    → blockout 変更後の再生成
```

補助: `localgpt_gen_set_tier` / `localgpt_gen_set_role` でエンティティに tier / role を付与。

Vault メモから plan する場合は [`docs/vault-note-plan-layout.md`](../../docs/vault-note-plan-layout.md) を参照。Roblox トレンド要約から prototype する場合は [`docs/roblox-trend-prototype.md`](../../docs/roblox-trend-prototype.md) を参照。短い説明文だけなら `localgpt_gen_plan` の方がシンプル。

### エクスポート & World Skills

| 状況 | Tool |
|------|------|
| スクリーンショット出力（vault プロジェクト含む） | `localgpt_gen_export_screenshot`（`path` または `world` / `session` / `vault_project`） |
| glTF 出力 | `localgpt_gen_export_gltf` |
| HTML（Three.js）出力 | `localgpt_gen_export_html` |
| ワールド保存 | `localgpt_gen_save` |
| ワールド読込 | `localgpt_gen_load` |
| 再利用可能なプロンプトパック保存（vault プロジェクト） | `localgpt_export_prompt_pack`（`name` / `description` / `vault_project`、`overwrite=true` で差し替え） |

## Design log ツール

全メモリ操作も MCP bridge 経由（要 `localgpt-gen` 起動）。

| 状況 | Tool |
|------|------|
| 過去の設計ログを検索 | `localgpt_design_log_search` |
| 検索結果の詳細を読む | `localgpt_design_log_get` |
| 長期設計ログとして保存 | `localgpt_design_log_save` |
| 日次ログに追記 | `localgpt_design_log_log` |

### Design log 連携フロー

1. 作業開始 → `localgpt_design_log_search` で過去の記録を確認
2. テーマ・スタイル決定 → `localgpt_design_log_save`
3. セッション記録 → `localgpt_design_log_log`

## 制約

- **1 call = 1 spawn** — 各 tool call で短寿命プロセスが起動・終了
- **リレー必須** — localgpt-gen が起動していないと全ツールが失敗
- **全ツール curated** — 50 tool をカバー。不足時は `localgpt_gen_call` で任意呼び出し

## コマンド

- `/localgpt:gen-status` — binary + relay 状態確認
