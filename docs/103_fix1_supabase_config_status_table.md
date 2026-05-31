# チケット103fix1：Supabase設定確認を人間向けテーブル表示にする

## 背景

現在、Vercel上で以下のURLを開くとSupabase接続設定の状態を確認できる。

```text
https://web-picross.vercel.app/api/supabase-config
```

ただし、表示はJSONそのままのため、人間が確認するには読みづらい。

現在の表示例:

```json
{
  "supabaseUrl": "https://efuqzpdxxekweumvbrhh.supabase.co",
  "supabasePublishableKey": "sb_publishable_...",
  "supabaseAnonKey": "sb_publishable_...",
  "configured": true
}
```

チケット103で `SUPABASE_PUBLISHABLE_KEY` への移行は完了しているが、確認画面としてはもう少し見やすくしたい。

## 目的

Supabase接続設定の確認結果を、人間が読みやすいテーブル形式で表示できるようにする。

ただし、アプリ側が利用する既存のJSON APIは壊さない。

## 対象ファイル（推定）

```text
api/supabase-config.js
server.js
js/admin.js
js/render.js
styles.css
README.md
docs/vercel_supabase_production_checklist.md
docs/ticket_status.json
```

必要に応じて追加:

```text
api/supabase-config-status.js
config-status.html
```

## 実装内容

### 1. 既存の `/api/supabase-config` はJSONのまま維持する

既存の以下APIは、アプリ側が読む可能性があるため、JSON返却のまま維持する。

```text
/api/supabase-config
```

このAPIの役割:

```text
Webピクロス本体がSupabase公開接続設定を取得する
機械処理用のJSONとして返す
```

このチケットでは、既存APIの返却形式をHTMLに変更しない。

### 2. 人間確認用の表示を別に用意する

以下のどちらかの方式で、人間確認用ページを追加する。

推奨案A:

```text
/api/supabase-config-status
```

ブラウザで開くとHTMLテーブルで表示する。

代替案B:

```text
/config-status.html
```

静的HTMLとして表示し、内部で `/api/supabase-config` を読み込んでテーブル化する。

実装しやすい方を採用してよい。

### 3. 表示内容

人間確認用ページでは、以下をテーブル形式で表示する。

| 項目 | 状態 | 表示内容 |
|---|---|---|
| SUPABASE_URL | OK/NG | URLを表示 |
| SUPABASE_PUBLISHABLE_KEY | OK/NG | `sb_publishable_...` のように先頭だけ表示 |
| SUPABASE_ANON_KEY互換 | 使用中/未使用 | 互換用に残っている場合のみ状態表示 |
| SUPABASE_SECRET_KEY | 非表示 | `サーバー専用 / ブラウザには表示しません` |
| configured | OK/NG | true / false |

### 4. Publishable keyはマスク表示する

`SUPABASE_PUBLISHABLE_KEY` は公開用キーだが、画面上では全文を出さず、読みやすい範囲でマスクする。

表示例:

```text
sb_publishable_p5EUDt...ENZspdct
```

または:

```text
設定済み
```

どちらでもよい。

### 5. Secret keyは絶対に表示しない

以下の値は、人間確認用ページにも、JSON APIにも、ブラウザ配信JSにも出さない。

```text
SUPABASE_SECRET_KEY
sb_secret_...
SUPABASE_SERVICE_ROLE_KEY
service_role key
JWT secret
DB password
```

Secret keyについては、値そのものも、先頭文字列も表示しない。

表示する場合は固定文言のみ。

```text
サーバー専用 / ブラウザには表示しません
```

### 6. configured の判定を分かりやすく表示する

`configured:true` の場合:

```text
Supabase接続設定: OK
```

`configured:false` の場合:

```text
Supabase接続設定: 未設定または不足
```

不足している項目も分かるようにする。

例:

```text
SUPABASE_URL: OK
SUPABASE_PUBLISHABLE_KEY: NG
configured: false
```

### 7. 見た目を既存テーマに合わせる

既存Webピクロスの黒基調・枠線・ボタンデザインに合わせる。

最低限必要な見た目:

```text
黒背景
白文字
テーブル罫線
OKは分かりやすい表示
NGは赤系表示
戻るリンクまたはトップへ戻るリンク
```

### 8. 管理者ページから開ける導線を追加する

可能なら、管理者ページの「システム情報」または「デバッグ操作」付近に、設定確認ページへのリンクを追加する。

ボタン名例:

```text
Supabase設定確認
```

クリック時の挙動:

```text
別タブで /api/supabase-config-status を開く
```

または:

```text
同一画面内に設定状態テーブルを表示する
```

既存レイアウトを崩さない範囲で実装する。

### 9. READMEと本番確認チェックリストを更新する

READMEまたは `docs/vercel_supabase_production_checklist.md` に以下を追記する。

```text
Supabase接続状態は /api/supabase-config-status で人間向けに確認できる。
/api/supabase-config はアプリ用JSONのため、通常確認は config-status を使う。
secret keyは表示されない。
```

## 受け入れ条件

### JSON API確認

以下を開く。

```text
https://web-picross.vercel.app/api/supabase-config
```

期待結果:

```text
JSONで返る
configured:true が確認できる
supabasePublishableKey が返る
sb_secret は含まれない
```

### 人間向け確認ページ

以下を開く。

```text
https://web-picross.vercel.app/api/supabase-config-status
```

または実装した確認ページを開く。

期待結果:

```text
テーブル形式で表示される
SUPABASE_URL の状態が分かる
SUPABASE_PUBLISHABLE_KEY の状態が分かる
configured の状態が分かる
```

### Secret key非表示確認

人間向け確認ページ、JSON API、ブラウザソース、DevTools Networkを確認する。

期待結果:

```text
sb_secret_... が表示されない
SUPABASE_SECRET_KEY の値が表示されない
service_role key が表示されない
```

### 管理者ページ導線確認

AdminQtaroでログインし、管理者ページを開く。

期待結果:

```text
システム情報またはデバッグ操作付近からSupabase設定確認へ移動できる
既存の管理者ページ表示が崩れていない
```

## NG条件

```text
/api/supabase-config をHTMLに変えてアプリ側が壊れる
SUPABASE_SECRET_KEY が画面に表示される
sb_secret_... がNetworkレスポンスに含まれる
configured:false なのにOK表示になる
設定確認ページの追加でログインやランキングが壊れる
```

## メモ

このチケットは確認性向上が目的。

Supabaseキーの移行自体はチケット103で完了済み。

管理者専用サーバーAPIの実装はチケット104で行う。
