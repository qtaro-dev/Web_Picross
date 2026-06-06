# ローカル起動・環境設定

READMEには最小手順だけを残し、詳細なローカル起動と環境設定はこのファイルにまとめます。

## 基本起動

```bash
npm install
npm start
```

起動後、ブラウザで以下を開きます。

```text
http://127.0.0.1:8000/
```

`npm start` は `node server.js` を実行し、ローカル開発用APIも利用できます。

## 静的確認

ユーザー登録のファイル保存APIを使わず、静的表示だけ確認する場合は次のコマンドを使えます。

```bash
python -m http.server 8000 --bind 127.0.0.1
```

この場合、固定ユーザー `admin` / `admin` での開発確認や、ブラウザ側 `localStorage` フォールバックが中心になります。

## Supabase接続確認

ローカルでSupabase連携を確認する場合は、プロジェクトルートに `.env` を作成し、公開設定値を設定します。

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxx
APP_BASE_URL=http://127.0.0.1:8000/
```

管理者サーバーAPIやインポートスクリプトを使う場合だけ、サーバー側環境変数として `SUPABASE_SECRET_KEY` を設定します。ブラウザ側JSや `js/config.js` には絶対に入れません。

設定状態は次のURLで確認できます。

```text
http://127.0.0.1:8000/api/supabase-config-status
```

アプリ用JSONとして確認する場合は次を使います。

```text
http://127.0.0.1:8000/api/supabase-config
```

詳細な仕様は [詳細仕様メモ](project_details.md) と [Supabase構成](supabase/README.md) を参照してください。
