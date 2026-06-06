# チケット100：Supabase公開接続設定の追加と未設定時エラー整理

## 背景

現在の `js/config.js` には、難易度設定、Build番号、入力制限、背景画像、色設定、入力チェック関数などは存在する。

一方で、Supabase接続に必要な以下の設定は入っていない。

```text
Supabase URL
anon key / publishable key
```

VercelにWebピクロスをデプロイした場合、画面自体は表示できても、Supabase設定が未定義だとログイン、ユーザー登録、ランキング保存、管理者ページ表示などが動作しない。

## 目的

WebピクロスがVercel上でもSupabaseへ接続できるように、公開してよいSupabase接続設定を追加する。

また、未設定時には画面上で分かりやすいメッセージを表示し、原因が分かるようにする。

## 重要方針

### 1. configに入れてよいのは公開キーだけ

`js/config.js` または関連設定ファイルに入れてよいもの:

```text
Supabase URL
anon key / publishable key
```

入れてはいけないもの:

```text
service_role key
secret key
DB password
JWT secret
```

### 2. service_role keyは扱わない

このチケット100では、service_role keyを一切扱わない。

管理者APIやAuth Admin API用のsecretは、Vercel FunctionsやSupabase Edge Functionsなど、サーバー側で別チケットとして扱う。

### 3. 静的フロントで使うanon keyは公開前提

Vercelで静的HTML/JSとして配信する場合、ブラウザで使う `anon key` はユーザーから見える。

これは公開前提のキーとして扱い、DB側はRLSとポリシーで保護する。

## 対象ファイル

推定対象:

```text
js/config.js
js/supabaseClient.js
js/supabaseAuth.js
js/supabaseProgress.js
js/actions.js
README.md
.env.example
.gitignore
docs/ticket_status.json
```

必要に応じて追加:

```text
js/config.example.js
js/config.local.js
```

## 実装内容

### 1. Supabase公開接続設定を追加する

`js/config.js` または既存構成に合わせた設定ファイルへ、Supabase公開接続設定を追加する。

例:

```js
export const SUPABASE_CONFIG = {
  url: '',
  anonKey: '',
};
```

または、既存の命名規則に合わせて以下のようにする。

```js
export const SUPABASE_PUBLIC_CONFIG = {
  url: '',
  publishableKey: '',
};
```

### 2. 未設定判定を追加する

Supabase URL または anon key が未設定の場合は、Supabaseクライアント初期化前に判定する。

未設定条件例:

```text
空文字
undefined
null
YOUR_SUPABASE_URL
YOUR_SUPABASE_ANON_KEY
```

### 3. 未設定時の画面メッセージを整える

ログイン、登録、パスワード再設定、ランキング保存、管理者ページなど、Supabaseが必要な処理で未設定だった場合、分かりやすいメッセージを表示する。

表示文言例:

```text
Supabase設定が未設定です。
管理者は config.js に Supabase URL と anon key を設定してください。
```

一般ユーザー向けには、内部名を出しすぎない文言でもよい。

```text
オンライン機能の設定が未完了です。管理者にお問い合わせください。
```

### 4. Supabaseクライアント初期化処理を調整する

既存の `supabaseClient.js` または相当箇所がある場合、追加した設定値を参照する。

想定:

```text
SUPABASE_CONFIG.url
SUPABASE_CONFIG.anonKey
```

未設定時はクライアントを作成せず、各処理側で安全に失敗させる。

### 5. .env.example または README に設定例を追加する

`.env.example` またはREADMEに、設定項目の意味を追記する。

ただし、静的フロントで直接読む方式の場合、`.env` だけではブラウザJSから読めない可能性があるため、実際の運用方式をREADMEに明記する。

README記載例:

```text
Vercel公開時は js/config.js の SUPABASE_CONFIG に Supabase URL と anon key を設定する。
service_role key は絶対に入れない。
```

または、`config.local.js` 分離方式を採用する場合:

```text
js/config.example.js をコピーして js/config.local.js を作成する。
js/config.local.js はGit管理しない。
```

### 6. GitHubへ秘密情報を誤コミットしないようにする

`config.local.js` 方式を採用する場合は、`.gitignore` に追加する。

```gitignore
js/config.local.js
```

ただし、Vercel本番で静的配信するために本番用anon keyを含む設定ファイルをコミットする設計にする場合は、anon keyのみであることをREADMEに明記する。

## 受け入れ条件

### 設定未入力

Supabase URL / anon key が未設定の状態でVercel版またはローカル版を開く。

期待結果:

```text
画面は表示される
ログインや登録を実行すると、設定未完了のメッセージが表示される
ブラウザコンソールに未処理例外が出続けない
```

### 設定入力済み

Supabase URL / anon key を設定する。

期待結果:

```text
ログインできる
ユーザー登録できる
profiles取得ができる
ランキング表示ができる
管理者ユーザーは管理者ページを開ける
```

### 秘密キー混入防止

`js/config.js` や公開JSを確認する。

期待結果:

```text
service_role key が含まれていない
secret key が含まれていない
DB password が含まれていない
```

### Vercel確認

VercelのURLでWebピクロスを開く。

期待結果:

```text
タイトル画面が表示される
ログイン画面へ進める
Supabase設定済みならログインできる
```

## NG条件

```text
service_role key をconfig.jsへ入れる
Supabase未設定時に画面が真っ白になる
未設定時に原因不明のログイン失敗だけが出る
anon key設定後もログインできない
```

## メモ

このチケットはチケット99とセットで進めること。

profilesの公開SELECTが広い状態でanon keyを設定すると、意図しない情報公開につながる可能性がある。
