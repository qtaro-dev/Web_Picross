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

# チケット60: Vercel・Supabase対応の全体構成整理

## 目的

Web Picrossをインターネット上で遊べる状態にするため、VercelとSupabaseを使った公開構成へ段階的に移行する。いきなり全実装せず、置き場所と移行順序を確定する。

## 基本方針

```text
Vercel:
- アプリ本体
- UI
- js/css/html
- docs/tickets
- Supabase接続コード
- 公開してよい設定

Supabase Database:
- profiles
- puzzles
- user_progress
- play_history
- ranking_records

Supabase Storage:
- bgm/
- se/
- backgrounds/
- title/
- thumbnails/
```

## 実装内容

- 現在の `data/`, `user/`, `image/`, `audio/`, `js/`, `server.js`, `package.json` を棚卸しする
- Vercelに置くもの、置かないものをdocsに整理する
- Supabase Databaseへ移すものを整理する
- Supabase Storageへ移すものを整理する
- READMEに公開構成方針を追記する
- 移行順序をdocsにまとめる

## 受け入れ条件

- Vercel / Supabase Database / Supabase Storage の役割分担がdocsに書かれている
- 移行順序が明確
- user/*.json がGit管理対象になっていない
- 既存ローカル起動が壊れない

## 最終報告

- 変更したファイル
- Vercel側に残すもの
- Supabase DBへ移すもの
- Supabase Storageへ移すもの
- 未確認事項
