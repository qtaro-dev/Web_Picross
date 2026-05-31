# チケット104：管理者専用サーバーAPI基盤追加

## 背景

Webピクロスでは、通常のログイン・ランキング保存・プロフィール取得などは、ブラウザ側からSupabaseの公開用キーで処理できる。

一方で、以下のような強い管理操作は、ブラウザ側だけでは行わない。

```text
Supabase Authユーザー本体の削除
Authユーザーのメールアドレス変更
Authユーザーの確認状態変更
管理者による強制的なAuth操作
```

これらは `SUPABASE_SECRET_KEY` を使う必要があるため、Vercel Functionsなどのサーバー側APIでのみ実行する。

## 目的

`SUPABASE_SECRET_KEY` を安全に使うための管理者専用API基盤を追加する。

ブラウザ側にはsecret keyを一切出さず、サーバー側で管理者本人確認を行った後だけ、強い管理操作を実行できる構造にする。

## 対象ファイル（推定）

```text
api/admin-auth.js
api/admin-users.js
api/admin-delete-auth-user.js
api/admin-update-auth-user.js
js/admin.js
js/supabaseClient.js
js/actions.js
README.md
.env.example
docs/vercel_supabase_production_checklist.md
docs/ticket_status.json
```

ファイル名は既存設計に合わせて変更可。

## 実装内容

### 1. 管理者APIの共通ガードを作る

Vercel Functions内で使う管理者認証ガードを作る。

例:

```text
api/_adminGuard.js
```

または既存の構成に合わせた名前にする。

共通ガードで行うこと:

```text
1. AuthorizationヘッダーからBearer tokenを取得する
2. tokenがなければ401を返す
3. SUPABASE_URL と SUPABASE_PUBLISHABLE_KEY で通常Supabase clientを作る
4. tokenからログイン中ユーザーを検証する
5. public.profiles を確認する
6. profiles.id がログイン中ユーザーIDと一致することを確認する
7. profiles.role = admin を確認する
8. profiles.account_status = active を確認する
9. 条件を満たさなければ403を返す
10. 条件を満たす場合のみ管理API処理へ進む
```

### 2. secret keyはサーバー側だけで読む

以下の環境変数をVercel Functions側で読む。

```text
SUPABASE_SECRET_KEY
```

絶対に以下へ出さない。

```text
/api/supabase-config のレスポンス
ブラウザJS
console.log
READMEの実値
GitHub
```

### 3. 管理者用Supabase clientを作る

管理者ガードを通過した後にだけ、`SUPABASE_SECRET_KEY` を使って管理者用Supabase clientを作る。

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

このclientは、Auth Admin APIやRLSを超えた必要な管理処理にのみ使う。

### 4. 最初の管理APIは疎通確認用でよい

まずは安全な疎通確認APIを作る。

例:

```text
GET /api/admin-auth-check
```

返す内容例:

```json
{
  "ok": true,
  "admin": true,
  "userId": "..."
}
```

このAPIは、管理者なら200、一般ユーザーなら403、未ログインなら401を返す。

### 5. Authユーザー操作APIの土台を作る

今後の実装に備えて、以下のAPI設計を追加する。

```text
POST /api/admin-delete-auth-user
POST /api/admin-update-auth-email
POST /api/admin-reset-auth-user
```

このチケット内で全機能を完成させる必要はないが、少なくとも以下は実装する。

```text
管理者認証ガード
入力チェック
未実装の場合は501を返す
secret keyを使う処理の場所を明確にする
```

余力があれば、`admin-delete-auth-user` だけ実装してもよい。

### 6. フロント側の呼び出し共通処理を作る

管理者ページからVercel Functionsを呼ぶ共通関数を追加する。

処理内容:

```text
1. Supabaseの現在セッションを取得する
2. access_token を取得する
3. Authorization: Bearer <token> を付けてAPIを呼ぶ
4. 401/403の場合は権限エラーを表示する
5. 500の場合は管理APIエラーを表示する
```

### 7. 管理者ページに疎通確認表示を追加する

管理者ページのシステム情報またはデバッグ操作に、管理API疎通確認を追加する。

表示例:

```text
管理者サーバーAPI: 利用可能
管理者サーバーAPI: 未設定
管理者サーバーAPI: 権限エラー
```

### 8. READMEに安全ルールを追記する

READMEに以下を追記する。

```text
SUPABASE_SECRET_KEY はVercel Environment Variablesにのみ保存する。
ブラウザ側JSには絶対に書かない。
管理者APIは必ずJWT検証とprofiles.role=admin確認を行う。
```

## 受け入れ条件

### 未ログイン確認

未ログイン状態で管理APIを直接開く、または呼ぶ。

期待結果:

```text
401 Unauthorized
```

### 一般ユーザー確認

一般ユーザーでログインして管理APIを呼ぶ。

期待結果:

```text
403 Forbidden
管理者専用です、などのメッセージが出る
```

### 管理者確認

AdminQtaroでログインして管理API疎通確認を行う。

期待結果:

```text
200 OK
admin: true
管理者サーバーAPI: 利用可能 と表示される
```

### secret key露出確認

ブラウザで以下を確認する。

```text
/api/supabase-config
ページソース
DevTools Console
Networkレスポンス
```

期待結果:

```text
sb_secret_... が表示されない
SUPABASE_SECRET_KEY の値が表示されない
```

## NG条件

```text
SUPABASE_SECRET_KEY がブラウザへ返る
管理者確認なしでsecret key処理が動く
一般ユーザーが管理APIを実行できる
未ログインで管理APIを実行できる
secret keyをjs/config.jsに書く
```

## メモ

このチケットは管理者用サーバーAPIの基盤追加が目的。

実際のユーザー削除、メール変更、Auth本体操作の詳細は、必要に応じて後続チケットで追加する。
