# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- 実装・修正はすべて AIエージェント が行う
- 既存設計・既存テーマ・ライブラリ構成を破壊しない
- チケット1〜64の実装済み機能を壊さない
- ローカル確認URLは `http://127.0.0.1:8000/` を標準とする
- Supabase Databaseにはパズルデータ、ユーザーデータ、クリア記録、ランキングを置く
- Supabase StorageにはBGM、SE、背景画像、タイトル画像、サムネイル画像などの素材ファイルを置く
- `user/*.json`、`users.json`、秘密鍵、service role key、DBパスワードはGitHub/Vercelへアップロードしない
- フロントエンドで使うのは公開可能なAnon Keyのみとする
- 変更後は対象JSファイルに対して `node --check` を実行する
- ビルドナンバー運用が実装済みの場合、今回の修正分としてビルド番号を +1 する

# チケット64-修正: ローカルnpm start環境でSupabase設定を取得できず、Supabase Auth登録に進まない不具合修正

## 目的

チケット64でSupabase Auth対応を実装したが、ローカル `npm start` 環境で `/api/supabase-config` が `405 Method Not Allowed` になり、Supabase設定が取得できていない。

その結果、Supabase登録・ログインではなく既存ローカルAPIへフォールバックしてしまい、Supabase Dashboard の Authentication Users / profiles にユーザーが登録されない。

この不具合を修正し、ローカル `http://127.0.0.1:8000/` でも `.env` の `SUPABASE_URL` / `SUPABASE_ANON_KEY` を読み取り、Supabase Auth登録・ログイン確認ができるようにする。

## 現在確認できている症状

ブラウザConsoleに以下が出ている。

```text
Failed to load resource: the server responded with a status of 405 (Method Not Allowed)
GET http://127.0.0.1:8000/api/supabase-config

Failed to load resource: the server responded with a status of 409 (Conflict)
POST http://127.0.0.1:8000/api/register
```

推定される流れ:

```text
1. フロントが /api/supabase-config を取得しようとする
2. ローカルExpress server.js側にGETルートが無く405になる
3. Supabase未設定扱いになる
4. 既存ローカル /api/register にフォールバックする
5. Supabase側にはユーザーが登録されない
```

## 対象ファイル（推定）

```text
E:\Dev\web_picross_Ver2\server.js
E:\Dev\web_picross_Ver2\api\supabase-config.js
E:\Dev\web_picross_Ver2\js\supabaseClient.js
E:\Dev\web_picross_Ver2\js\supabaseAuth.js
E:\Dev\web_picross_Ver2\js\actions.js
E:\Dev\web_picross_Ver2\js\config.js
E:\Dev\web_picross_Ver2\package.json
E:\Dev\web_picross_Ver2\README.md
```

## 実装内容

### 1. ローカルExpress server.jsに `/api/supabase-config` のGETルートを追加する

ローカル `npm start` 時にも以下URLが動作するようにする。

```text
GET http://127.0.0.1:8000/api/supabase-config
```

返却例:

```json
{
  "supabaseUrl": "https://xxxxx.supabase.co",
  "supabaseAnonKey": "sb_publishable_xxxxx",
  "configured": true
}
```

`.env` が未設定の場合:

```json
{
  "supabaseUrl": "",
  "supabaseAnonKey": "",
  "configured": false
}
```

### 2. server.jsで.envを読み込めるようにする

ローカル開発時に `.env` を読み込む。

必要であれば `dotenv` を導入する。

```bat
npm install dotenv
```

server.js側で読み込む。

```js
require("dotenv").config();
```

または既存のモジュール形式に合わせて適切に実装する。

### 3. 返却するキーはAnon Keyだけにする

`/api/supabase-config` から返してよいのは以下のみ。

```text
SUPABASE_URL
SUPABASE_ANON_KEY
configured
```

絶対に返してはいけないもの:

```text
SUPABASE_SERVICE_ROLE_KEY
DB password
JWT secret
その他secret系
```

### 4. Vercel側の `api/supabase-config.js` とローカルserver.jsの挙動を揃える

Vercel Functions用の `api/supabase-config.js` と、ローカルExpressの `/api/supabase-config` が同じ形式のJSONを返すようにする。

フロント側は実行環境を意識せず、常に以下を取得できるようにする。

```text
/api/supabase-config
```

### 5. js/supabaseClient.js側で405時の原因が分かるログを出す

Supabase設定取得に失敗した場合、最低限Consoleに原因が分かるログを出す。

例:

```text
Supabase config fetch failed. Falling back to local mode.
```

ただし、ユーザー向け画面にエラーを大量表示しない。

### 6. Supabase設定取得成功時はSupabase Authを優先する

`/api/supabase-config` が `configured: true` を返した場合は、登録・ログイン時にSupabase Authを優先する。

仕様:

```text
- Supabase設定あり → Supabase Auth登録/ログイン
- Supabase設定なし → 既存ローカル登録/ログインへフォールバック
```

### 7. ローカルフォールバックは維持する

Supabase未設定時や取得失敗時に既存ローカル動作が壊れないようにする。

維持するもの:

```text
- 固定 admin/admin
- 既存 /api/login
- 既存 /api/register
- users.json / user/*.json を使うローカル開発挙動
```

ただし、本番VercelではローカルJSON保存に依存しない方針を維持する。

### 8. READMEにローカルSupabase確認手順を追記する

READMEに以下の確認手順を追記する。

```text
1. E:\Dev\web_picross_Ver2\.env を作成
2. SUPABASE_URL と SUPABASE_ANON_KEY を設定
3. npm start
4. http://127.0.0.1:8000/api/supabase-config をブラウザで開く
5. configured: true になることを確認
6. アプリで新規ユーザー登録
7. Supabase Dashboard → Authentication → Users にユーザーが増えることを確認
8. Supabase Dashboard → Table Editor → profiles にusernameが増えることを確認
```

## 受け入れ条件

```text
- http://127.0.0.1:8000/api/supabase-config をGETで開ける
- .env設定済みの場合 configured: true が返る
- .env未設定の場合 configured: false が返る
- service role key やDB passwordが返却されない
- ローカルnpm start環境でSupabase Auth登録が実行される
- Supabase Dashboard → Authentication → Users に新規ユーザーが増える
- Supabase Dashboard → Table Editor → profiles にusernameが増える
- Supabase設定ありの時、登録/ログインが既存 /api/register / /api/login に落ちない
- Supabase未設定時は既存ローカル登録/ログインにフォールバックする
- 既存のゲーム画面、メニュー、ゲームセレクトが壊れない
- node --check が変更したJSファイルすべてで通る
```

## 確認手順

### 1. サーバ再起動

```bat
cd /d E:\Dev\web_picross_Ver2
npm start
```

### 2. Supabase設定API確認

ブラウザで開く。

```text
http://127.0.0.1:8000/api/supabase-config
```

期待結果:

```json
{
  "configured": true
}
```

※ `supabaseUrl` と `supabaseAnonKey` が返る場合でも、service role keyやDB passwordが含まれていないこと。

### 3. アプリでユーザー登録

```text
http://127.0.0.1:8000/
```

新規ユーザー例:

```text
username: test_supabase_64_fix
password: 任意
```

### 4. Supabase側確認

Supabase Dashboardで確認する。

```text
Authentication
→ Users
→ test_supabase_64_fix 相当のユーザーが増えていること
```

次に:

```text
Table Editor
→ public
→ profiles
→ username = test_supabase_64_fix が増えていること
```

### 5. フォールバック確認

`.env` を一時的に退避するか、値を空にして再起動する。

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

確認:

```text
- /api/supabase-config が configured:false
- 既存ローカルログインが壊れていない
```

## 最終報告

```text
- 変更したファイル
- server.jsに追加した/api/supabase-configの内容
- dotenv導入有無
- Vercel用api/supabase-config.jsとの返却形式の整合
- Supabase設定あり時の登録/ログイン確認結果
- Supabase Authentication Users確認結果
- profiles確認結果
- Supabase未設定時のfallback確認結果
- service role keyやDB passwordを返していない確認結果
- node --check の結果
- http://127.0.0.1:8000/ での確認結果
- 未確認事項または注意点
```
