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

# チケット66: パズルデータをSupabase Databaseへ移行する

## 目的

現在 `data/*.json` で管理しているパズル問題データを、Supabase Databaseの `puzzles` テーブルへ移行できるようにする。

## 実装内容

- `scripts/importPuzzlesToSupabase.js` を作成する
- `data/beginner.json`、`easy.json`、`normal.json`、`hard.json`、`endless.json` を読み込む
- ファイル名から `difficulty` を判定する
- `stage_no` を付与する
- `title`、`width`、`height`、`color_mode`、`palette`、`solution` を整形する
- Supabaseへupsertする
- Supabase設定ありの場合は `puzzles` から問題一覧を取得する
- Supabase未設定の場合は従来通り `data/*.json` から取得する
- `is_published=false` は本番ゲームセレクトに表示しない

## 受け入れ条件

- data/*.jsonからSupabaseへインポートできる
- Supabaseからゲームセレクトを表示できる
- Supabase未設定ならローカルJSONで遊べる
- is_published=falseが本番表示されない
- ランキング画面のパズル名非表示方針が維持される
- node --check が通る

## 最終報告

- 変更したファイル
- インポートスクリプト
- JSON→DB変換仕様
- Supabase取得処理
- fallback動作
