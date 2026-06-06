# Supabase構成

Web Picrossのオンライン機能はSupabaseを使います。未設定時はSupabaseへ接続せず、既存のローカルJSON / `localStorage` 動作へフォールバックします。

## 利用範囲

- Supabase Auth: ユーザー登録、ログイン、メール確認、パスワード再設定
- Supabase Database: `profiles`、`puzzles`、`user_progress`、`play_history`、`ranking_records`、お知らせ、削除申請ログなど
- Supabase Storage: お知らせ画像用 `news-images` bucket
- RLS: 公開データ、本人データ、管理者データの分離

## 公開してよい値と非公開値

公開してよい値:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

公開しない値:

- `SUPABASE_SECRET_KEY`
- service role key
- DBパスワード
- JWT secret
- Vercel/GitHub token

ブラウザ側JSや `js/config.js` には公開前提の値だけを置きます。管理者サーバーAPIやインポートスクリプトで必要なsecretは、Vercel Environment Variablesまたはローカル `.env` にだけ保存します。

## SQLファイル

- [000_architecture_plan.md](000_architecture_plan.md)
- [001_schema.sql](001_schema.sql)
- [002_rls.sql](002_rls.sql)
- [003_storage_design.md](003_storage_design.md)
- [006_news_posts.sql](006_news_posts.sql)
- [007_news_storage.sql](007_news_storage.sql)
- [010_ranking_verified_writes.sql](010_ranking_verified_writes.sql)
- [013_normalize_puzzle_keys.sql](013_normalize_puzzle_keys.sql)

詳細な運用手順は [運用メモ](../operation_notes.md) と [詳細仕様メモ](../project_details.md) を参照してください。
