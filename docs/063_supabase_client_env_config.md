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

# チケット63: Supabase接続設定と環境変数対応

## 目的

Web PicrossからSupabaseへ接続できるように、Supabaseクライアントと環境変数の扱いを実装する。

## 実装内容

- `@supabase/supabase-js` を導入する
- `js/supabaseClient.js` を作成する
- `.env.example` を作成する
- `.gitignore` に `.env`、`.env.*`、例外として `!.env.example` を設定する
- READMEにVercel環境変数設定手順を追記する
- Supabase未設定時は既存ローカル動作へフォールバックする

## 環境変数

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## 注意

```text
SUPABASE_SERVICE_ROLE_KEY はフロントエンドで使わない
DBパスワードをGitHubへ載せない
.envをGitHubへ載せない
```

## 受け入れ条件

- package.jsonにsupabase-jsが追加されている
- Supabaseクライアントファイルがある
- .env.exampleがある
- Supabase未設定でも画面が壊れない
- node --check が通る

## 最終報告

- 変更したファイル
- 追加したnpmパッケージ
- 環境変数名
- fallback動作
