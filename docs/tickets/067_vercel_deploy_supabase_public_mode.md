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

# チケット67: Vercel公開用設定とSupabase本番モード確認

## 目的

GitHub連携したVercelでWeb Picrossを公開し、Supabaseを使ってユーザー登録、パズル取得、クリア記録、ランキング、素材取得ができる状態にする。

## 実装内容

- VercelでGitHub連携デプロイできることを確認する
- Vercel環境変数に `SUPABASE_URL`、`SUPABASE_ANON_KEY` を設定する
- 本番では `user/*.json`、`users.json`、大量の `data/*.json`、大量素材へ依存しない
- Supabase Storageから背景画像、BGM、SE、タイトル画像、サムネイルを取得する
- READMEにVercel公開手順を追記する

## 確認導線

```text
タイトル
→ ログイン/ユーザー登録
→ メニュー
→ ゲームセレクト
→ ゲーム開始
→ クリア
→ ユーザーデータ
→ ランキング
→ オプション
→ ヘルプ
→ クレジット
```

## 受け入れ条件

- Vercelでデプロイできる
- 公開URLでタイトル画面が表示される
- Supabase経由でログイン/登録できる
- Supabaseからパズルを取得できる
- クリア記録がSupabaseへ保存される
- ランキングがSupabaseから表示される
- 背景画像/BGM/SEがSupabase Storageから取得できる
- Vercel本番でuser/*.jsonへ依存しない

## 最終報告

- 変更したファイル
- Vercel設定内容
- Supabase環境変数
- 本番公開URL
- 確認した導線
- 未確認事項
