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

# チケット64: ユーザー登録・ログインをSupabase対応へ移行

## 目的

現在のローカルJSON / users.jsonベースのユーザー登録・ログインを、Supabase側のユーザーデータ管理へ段階的に移行する。

## 実装内容

- 既存ログイン画面を維持する
- 登録時にSupabaseへユーザー情報を保存する
- `profiles` に `username`、`display_name`、`role` を保存する
- `admin/admin` を開発用初期ユーザーとして扱う
- ログイン成功時に `state.currentUser` へSupabaseユーザー情報を保持する
- Supabase未設定時は既存ローカルログインへフォールバックする
- 本番モードでは `users.json` に依存しない

## state保持案

```text
user_id
username
display_name
role
loginSource: "supabase"
```

## 受け入れ条件

- Supabase設定済みでユーザー登録できる
- Supabase設定済みでログインできる
- admin/adminも開発用として扱える
- Supabase未設定なら既存ログインが動く
- users.jsonがGitHubに上がらない
- node --check が通る

## 最終報告

- 変更したファイル
- Supabase登録処理
- Supabaseログイン処理
- fallback動作
