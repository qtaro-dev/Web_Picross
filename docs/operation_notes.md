# 運用メモ

Vercel公開、Supabase適用、SQL更新、本番確認などの運用上の注意をまとめます。

## 本番確認

Vercel公開後のSupabase設定、メール確認、パスワード再設定、管理者ログイン、ランキング保存、管理者再設定メール送信の確認手順は [Vercel / Supabase本番確認チェックリスト](vercel_supabase_production_checklist.md) を参照してください。

## SQL適用

Supabaseの既存環境へ列やRLSを追加した場合は、必要に応じて次を実行してPostgRESTのスキーマキャッシュを更新します。

```sql
NOTIFY pgrst, 'reload schema';
```

既存DBの `puzzle_key` を正式形式へ揃える場合は、[013_normalize_puzzle_keys.sql](supabase/013_normalize_puzzle_keys.sql) をSupabase SQL Editorで確認後に手動適用します。

## 公開前の注意

- `.env` と `.env.*` はGit管理しません。
- `SUPABASE_SECRET_KEY`、DBパスワード、JWT secret、Vercel/GitHub token は公開しません。
- `users.json`、`user/*.json` はローカル開発用であり、GitHub/Vercelへアップロードしません。
- 公開画像用の `news-images` bucketはpublic bucketです。機密画像を置かないでください。

詳細は [詳細仕様メモ](project_details.md) と [Supabase構成](supabase/README.md) を参照してください。
