# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- 実装・修正はすべて AIエージェント が行う
- 既存設計・既存テーマ・ライブラリ構成を破壊しない
- チケット1〜59の実装済み機能を壊さない
- ローカル確認URLは `http://127.0.0.1:8000/` を標準とする
- Vercelにはアプリ本体、UI、docs、チケット、公開してよい設定のみ置く
- Supabase Databaseにはパズルデータ、ユーザーデータ、クリア記録、ランキングを置く
- Supabase StorageにはBGM、SE、背景画像、タイトル画像、サムネイル画像などの素材ファイルを置く
- `user/*.json`、`users.json`、秘密鍵、service role key、DBパスワードはGitHub/Vercelへアップロードしない
- フロントエンドで使うのは公開可能なAnon Keyのみとする
- 変更後は対象JSファイルに対して `node --check` を実行する
- ビルドナンバー運用が実装済みの場合、今回の修正分としてビルド番号を +1 する

# チケット61: Supabase Database設計とSQL作成

## 目的

ユーザーデータ、パズルデータ、クリア記録、ランキングをSupabase Databaseで管理できるように、テーブル設計と初期SQLを作成する。

## 作成するテーブル

```text
profiles
puzzles
user_progress
play_history
ranking_records
```

## 実装内容

- `docs/supabase/001_schema.sql` を作成する
- `docs/supabase/002_rls.sql` を作成する
- `profiles`、`puzzles`、`user_progress`、`play_history`、`ranking_records` のCREATE TABLEを書く
- `difficulty`、`stage_no`、`puzzle_id`、`user_id` に必要なindexを作る
- `updated_at` 自動更新triggerを作る
- RLS方針を書く
- `admin/admin` は開発用であり、本番ではそのまま使わないことをdocsへ記載する

## 最低テーブル要件

```text
profiles:
- id
- username
- display_name
- role
- created_at
- updated_at

puzzles:
- id
- difficulty
- stage_no
- title
- width
- height
- color_mode
- palette jsonb
- solution jsonb
- thumbnail_path
- is_published

user_progress:
- user_id
- puzzle_id
- cleared
- best_clear_time_ms
- latest_clear_time_ms
- clear_count
- fail_count
- giveup_count
- hint_used_count

play_history:
- user_id
- puzzle_id
- result
- play_time_ms
- hint_used_count

ranking_records:
- user_id
- puzzle_id
- difficulty
- stage_no
- clear_time_ms
```

## 受け入れ条件

- schema SQLがある
- RLS SQLがある
- JSONデータの移行先が明確
- 既存ローカル動作が壊れない

## 最終報告

- 作成したSQLファイル
- 作成したテーブル
- RLS方針
- adminユーザー方針
