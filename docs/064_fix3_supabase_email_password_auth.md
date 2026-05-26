# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- 実装・修正はすべて AIエージェント が行う
- 既存設計・既存テーマ・ライブラリ構成を破壊しない
- チケット1〜64、64fix、64fix2の実装済み機能を壊さない
- ローカル確認URLは `http://127.0.0.1:8000/` を標準とする
- Supabase Databaseにはパズルデータ、ユーザーデータ、クリア記録、ランキングを置く
- Supabase StorageにはBGM、SE、背景画像、タイトル画像、サムネイル画像などの素材ファイルを置く
- `user/*.json`、`users.json`、秘密鍵、service role key、DBパスワードはGitHub/Vercelへアップロードしない
- フロントエンドで使うのは公開可能なAnon Keyのみとする
- Supabase Authは正規の email/password 方式を使う
- 架空メール生成方式は廃止する
- 変更後は対象JSファイルに対して `node --check` を実行する
- ビルドナンバー運用が実装済みの場合、今回の修正分としてビルド番号を +1 する

# チケット64fix3: Supabase Authを正規のメールアドレス方式へ変更する

## 目的

現在のSupabase Auth登録処理では、ユーザー名から内部メールアドレスを生成している。

例:

```text
test_supabase_64_fix2@web-picross.example.com
```

しかし、この方式ではSupabase Auth側で `invalid email` として拒否されるケースがあり、実際に以下のエラーが出ている。

```text
/auth/v1/signup 400 Bad Request
Email address "test_supabase_64_fix2@web-picross.example.com" is invalid
```

架空メール生成方式はややこしく、今後の運用にも向かないため廃止する。

ユーザー登録・ログインを、Supabase Authの正規方式である `メールアドレス + パスワード` に変更する。

## 方針

### 登録画面

登録時は以下を入力する。

```text
- ユーザー名
- メールアドレス
- パスワード
```

Supabase Authには以下を渡す。

```text
email
password
```

profilesには以下を保存する。

```text
user_id
username
email
display_name
role
created_at
updated_at
```

### ログイン画面

ログイン時は以下を入力する。

```text
- メールアドレス
- パスワード
```

ログイン後の画面表示名は `profiles.username` を使う。

## 対象ファイル（推定）

```text
E:\Dev\web_picross_Ver2\js\supabaseAuth.js
E:\Dev\web_picross_Ver2\js\supabaseClient.js
E:\Dev\web_picross_Ver2\js\actions.js
E:\Dev\web_picross_Ver2\js\render.js
E:\Dev\web_picross_Ver2\js\state.js
E:\Dev\web_picross_Ver2\js\config.js
E:\Dev\web_picross_Ver2\styles.css
E:\Dev\web_picross_Ver2\README.md
```

必要に応じて:

```text
E:\Dev\web_picross_Ver2\docs\supabase\001_schema.sql
E:\Dev\web_picross_Ver2\docs\supabase\002_rls.sql
```

## 実装内容

### 1. 架空メール生成処理を廃止する

以下のような処理を使わない。

```text
createInternalEmailFromUsername()
username + "@web-picross.example.com"
username + "@web-picross.local"
```

登録時・ログイン時ともに、ユーザーが入力したメールアドレスをSupabase Authへ渡す。

### 2. 登録画面にメールアドレス入力欄を追加する

ログイン / ユーザー登録画面に、登録用メールアドレス欄を追加する。

最低限のUI:

```text
ユーザー名
メールアドレス
パスワード
[ログイン] [ユーザー登録]
```

ただしログイン時にユーザー名が不要になる場合、UIを以下のように分けてもよい。

```text
ログイン:
- メールアドレス
- パスワード

ユーザー登録:
- ユーザー名
- メールアドレス
- パスワード
```

既存UIを大きく壊さない範囲で、分かりやすい形にする。

### 3. 登録処理をemail/passwordへ変更する

Supabase登録時は以下を使う。

```text
email
password
```

Supabase Auth登録後、返却された `user.id` を使って `profiles` にユーザー情報を保存する。

profiles保存内容:

```text
id または user_id: Supabase Authのuser.id
username: 入力されたユーザー名
email: 入力されたメールアドレス
display_name: 入力されたユーザー名
role: "user"
```

### 4. ログイン処理をemail/passwordへ変更する

Supabaseログイン時は以下を使う。

```text
email
password
```

ログイン成功後、Supabase Authの `user.id` を使って `profiles` を取得する。

`state.currentUser` には以下を保持する。

```text
user_id
username
email
display_name
role
loginSource: "supabase"
```

### 5. 画面上の表示名はusernameを使う

ログイン後のメニュー画面などで表示する名前はメールアドレスではなく `profiles.username` にする。

例:

```text
test_supabase_64_fix3
```

メールアドレスはログイン認証用であり、通常画面には表示しない。

### 6. profilesテーブルにemail列がない場合は追加SQLを用意する

既存の `profiles` に `email` 列がない場合、追加SQLを用意する。

候補:

```sql
alter table public.profiles
add column if not exists email text;
```

必要であれば以下も検討する。

```sql
create unique index if not exists profiles_email_unique
on public.profiles(email);
```

ただし、既存RLSやprofiles登録処理を壊さないこと。

### 7. メール確認設定の注意をREADMEに書く

Supabase側でメール確認がONの場合、登録直後にログインできない可能性がある。

READMEに以下を追記する。

```text
開発中に登録直後ログインを確認したい場合は、Supabase Authenticationのメール確認設定を確認すること。
メール確認がONの場合、確認メールを承認するまでログインできない場合がある。
```

### 8. Supabase未設定時のローカルフォールバックを維持する

Supabase設定が無い場合、または `/api/supabase-config` が `configured:false` の場合は、既存ローカル登録・ログインへフォールバックする。

維持するもの:

```text
- 固定 admin/admin
- 既存 /api/login
- 既存 /api/register
- users.json / user/*.json を使うローカル開発挙動
```

ローカルフォールバック時は、従来通りユーザー名 + パスワードで動いてよい。

### 9. 既存の「ユーザー名とパスワードを記録する」機能を調整する

Supabaseログイン時はメールアドレス + パスワードを使うため、記録対象も以下へ変更する。

```text
- メールアドレス
- パスワード
```

ユーザー登録時は、必要であればユーザー名も保持してよい。

ただし、保存形式やcookie/localStorageの既存仕様を不用意に壊さないこと。

## 受け入れ条件

```text
- 架空メール生成処理が使われていない
- 登録画面でユーザー名・メールアドレス・パスワードを入力できる
- Supabase Auth登録時に入力メールアドレスが使われる
- Supabase Authentication → Users に登録ユーザーが増える
- Supabase Table Editor → public → profiles に username / email が保存される
- 登録したメールアドレス + パスワードでログインできる
- ログイン後の表示名はメールアドレスではなくusernameになる
- state.currentUser に user_id / username / email / display_name / role / loginSource が入る
- Supabase未設定時は既存ローカル登録・ログインが壊れない
- service role keyやDB passwordを扱っていない
- node --check が変更したJSファイルすべてで通る
```

## 確認手順

### 1. サーバ再起動

```bat
cd /d E:\Dev\web_picross_Ver2
npm start
```

### 2. Supabase設定確認

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

### 3. 新規ユーザー登録

アプリを開く。

```text
http://127.0.0.1:8000/
```

登録例:

```text
ユーザー名: test_supabase_64_fix3
メールアドレス: 自分で確認できるメール、または形式として有効なテスト用メール
パスワード: test1234
```

### 4. Supabase Dashboard確認

```text
Authentication
→ Users
→ 登録メールアドレスのユーザーが増えていること
```

次に:

```text
Table Editor
→ public
→ profiles
→ username = test_supabase_64_fix3
→ email = 登録メールアドレス
```

### 5. ログイン確認

一度ログアウトし、登録したメールアドレスとパスワードでログインする。

期待結果:

```text
- ログインできる
- メニュー画面へ進める
- 画面上の表示名が username になる
```

### 6. Console確認

ブラウザDevTools Consoleで以下が出ないこと。

```text
Email address "...@web-picross.local" is invalid
Email address "...@web-picross.example.com" is invalid
/auth/v1/signup 400 Bad Request
```

## 最終報告

```text
- 変更したファイル
- 廃止した架空メール生成処理
- 登録画面の変更内容
- ログイン画面の変更内容
- Supabase Authへ渡す値
- profiles保存内容
- profiles.email列追加有無
- 登録ユーザーのAuthentication Users確認結果
- profiles確認結果
- 登録メールアドレスでログインできた確認結果
- 表示名がusernameになっている確認結果
- Supabase未設定時のfallback確認結果
- service role keyやDB passwordを扱っていない確認結果
- node --check の結果
- 未確認事項または注意点
```
