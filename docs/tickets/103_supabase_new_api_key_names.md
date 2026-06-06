# チケット103：Supabase新APIキー名への移行

## 背景

現在のWebピクロスでは、Vercel環境変数として以下の名前を使っている、または使う前提が残っている可能性がある。

```text
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

しかし、Supabase側では新しいAPIキー体系として以下が用意されている。

```text
Publishable key: sb_publishable_...
Secret key: sb_secret_...
```

今後の混乱を避けるため、Webピクロス側の環境変数名も新しいキー体系に合わせる。

## 目的

Supabase接続設定の環境変数名を新しい名前に統一する。

公開用キーは `SUPABASE_PUBLISHABLE_KEY`、管理者サーバー処理用キーは `SUPABASE_SECRET_KEY` として扱う。

## 対象ファイル（推定）

```text
api/supabase-config.js
server.js
js/supabaseClient.js
js/config.js
.env.example
README.md
docs/vercel_supabase_production_checklist.md
docs/ticket_status.json
```

## 実装内容

### 1. 公開用キー名を変更する

旧名:

```text
SUPABASE_ANON_KEY
```

新名:

```text
SUPABASE_PUBLISHABLE_KEY
```

`api/supabase-config.js` や `server.js` など、Vercel環境変数から公開用キーを読む箇所を確認し、`SUPABASE_PUBLISHABLE_KEY` を優先して読むようにする。

互換性を残す場合は、一時的に以下の優先順にしてもよい。

```text
SUPABASE_PUBLISHABLE_KEY
↓
SUPABASE_ANON_KEY
```

ただし、READMEには新規設定では `SUPABASE_PUBLISHABLE_KEY` を使うことを明記する。

### 2. 管理者サーバー処理用キー名を定義する

旧名:

```text
SUPABASE_SERVICE_ROLE_KEY
```

新名:

```text
SUPABASE_SECRET_KEY
```

このチケットでは、まだ `SUPABASE_SECRET_KEY` を使う強い管理APIの実処理は作らなくてよい。

次チケット104で使用する前提として、名前とドキュメントだけ整理する。

### 3. `/api/supabase-config` の返却内容を確認する

`/api/supabase-config` は、ブラウザ側がSupabaseへ接続するための公開情報だけを返す。

返してよいもの:

```text
supabaseUrl
supabasePublishableKey
configured
```

返してはいけないもの:

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
sb_secret_...
service_role key
DB password
JWT secret
```

既存の返却名が `supabaseAnonKey` の場合、可能なら `supabasePublishableKey` に変更する。

ただし、変更によって既存JSが壊れる場合は、互換用に一時的に両方返してもよい。

例:

```json
{
  "supabaseUrl": "https://xxxxx.supabase.co",
  "supabasePublishableKey": "sb_publishable_...",
  "configured": true
}
```

### 4. クライアント側参照を更新する

`js/supabaseClient.js` などで、`supabaseAnonKey` または `anonKey` として扱っている箇所を確認する。

新名称に合わせて、内部変数名も可能な範囲で以下へ寄せる。

```text
publishableKey
supabasePublishableKey
```

ただし、Supabaseクライアント作成処理自体は、公開キーを渡せばよいので、機能上は同じ。

### 5. `.env.example` を更新する

`.env.example` には以下を記載する。

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxx
SUPABASE_SECRET_KEY=YOUR_SERVER_SIDE_SUPABASE_SECRET_KEY
```

以下の旧名は、必要なら「旧名」としてコメントに残すだけにする。

```env
# Legacy:
# SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
```

### 6. READMEを更新する

READMEに以下を明記する。

```text
Vercel環境変数には SUPABASE_URL と SUPABASE_PUBLISHABLE_KEY を設定する。
管理者サーバーAPIを使う場合のみ SUPABASE_SECRET_KEY を設定する。
SUPABASE_SECRET_KEY はブラウザへ返してはいけない。
```

### 7. Vercel設定手順を更新する

`docs/vercel_supabase_production_checklist.md` に、VercelのEnvironment Variablesとして以下を設定する手順を追加する。

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

ただし、`SUPABASE_SECRET_KEY` はチケット104以降の管理者専用サーバーAPIで使うことを明記する。

## 受け入れ条件

### Vercel環境変数確認

Vercelに以下の環境変数を設定できる。

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

### `/api/supabase-config` 確認

ブラウザで以下を開く。

```text
https://web-picross.vercel.app/api/supabase-config
```

期待結果:

```text
configured が true
公開用キーが取得できる
secret key は表示されない
```

### ログイン確認

Vercel版で一般ユーザーがログインできる。

期待結果:

```text
ログインできる
メニュー画面へ入れる
ランキング画面が表示される
```

### 管理者確認

Vercel版でAdminQtaroがログインできる。

期待結果:

```text
ログインできる
ADMINバッジが表示される
管理者ページボタンが表示される
```

## NG条件

```text
SUPABASE_SECRET_KEY が /api/supabase-config に出る
SUPABASE_SECRET_KEY がブラウザJSに含まれる
SUPABASE_SECRET_KEY を js/config.js に書く
GitHubに sb_secret_... が入る
公開用キー名変更後にログインできなくなる
```

## メモ

このチケットはキー名の整理が目的。

強い管理APIの実装はチケット104で行う。
