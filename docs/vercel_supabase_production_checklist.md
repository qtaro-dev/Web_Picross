# Vercel公開後 Supabase本番確認チェックリスト

## 確認対象URL

- Production URL: `https://web-picross.vercel.app/`
- Preview URL: `https://web-picross-f7uyvvoxs-qtaro-devs-projects.vercel.app/`
- Local URL: `http://127.0.0.1:8000/`

まずProduction URLを確認対象にします。Preview URLはVercelのプレビュー確認が必要な場合だけ使います。

## Supabase Redirect URLs

Supabase Dashboardで次を開きます。

```text
Authentication
→ URL Configuration
→ Redirect URLs
```

次のURLを登録します。

```text
https://web-picross.vercel.app/
https://web-picross-f7uyvvoxs-qtaro-devs-projects.vercel.app/
http://127.0.0.1:8000/
```

NG: 確認メールやパスワード再設定メールのリンク先が `localhost` だけになる。

## Supabase公開接続設定

Vercelで使う公開設定はSupabase URLとpublishable keyだけです。secret key、DB password、JWT secretはフロントエンドへ置きません。

確認する場所:

```text
js/config.js
→ SUPABASE_PUBLIC_CONFIG.url
→ SUPABASE_PUBLIC_CONFIG.publishableKey
```

またはVercel Functionsで `/api/supabase-config` を使う場合:

```text
Vercel Project Settings
→ Environment Variables
→ SUPABASE_URL
→ SUPABASE_PUBLISHABLE_KEY
→ SUPABASE_SECRET_KEY
```

`SUPABASE_SECRET_KEY` はチケット104以降の管理者専用サーバーAPIやローカルインポートスクリプトだけで使います。`/api/supabase-config` から返してよいのは `supabaseUrl`、`supabasePublishableKey`、`configured` だけで、`SUPABASE_SECRET_KEY` や `sb_secret_...` は返しません。

人間が設定状態を確認する場合は、次を開きます。`/api/supabase-config` はアプリ用JSONのため、通常確認はこの設定確認ページを使います。

```text
https://web-picross.vercel.app/api/supabase-config-status
```

OK:

```text
Supabase接続設定: OK
SUPABASE_URL: OK
SUPABASE_PUBLISHABLE_KEY: OK
SUPABASE_SECRET_KEY は値が表示されない
```

## 事前DB確認

Supabase SQL Editorで `docs/supabase/001_schema.sql` と `docs/supabase/002_rls.sql` の最新版を適用します。

確認する主なテーブル・View:

```text
profiles
public_profiles
puzzles
user_progress
play_history
ranking_records
account_delete_requests
```

`profiles` 本体のSELECTは本人または管理者だけです。ランキングなどの公開表示は `public_profiles` の `id`、`username`、`display_name` だけを使います。

## 基本表示

手順:

1. テスターがProduction URLを開く。
2. タイトル画面が表示されることを確認する。
3. タイトル画面左下に現在のBuild番号が表示されることを確認する。
4. タイトルを押してログイン画面へ進む。

OK:

```text
タイトル画面が表示される
ログイン画面へ進める
```

NG:

```text
画面が真っ白
ログイン画面へ進めない
```

## メール確認テスト

手順:

1. テスターがProduction URLを開く。
2. ログイン画面でユーザー名、メールアドレス、パスワードを入力する。
3. 「ユーザー登録」を押す。
4. 画面に確認メール案内が出ることを確認する。
5. 入力したメールアドレスの受信箱を開く。
6. Supabaseからの確認メールを開く。
7. 確認リンクを押す。
8. Production URLへ戻ることを確認する。
9. 同じメールアドレスとパスワードでログインする。
10. メニュー画面へ入れることを確認する。

OK:

```text
確認メールが届く
確認リンクがProduction URLへ戻る
確認後にログインできる
```

NG:

```text
確認メールが届かない
確認リンクがlocalhostへ戻る
確認後もメール未確認扱いになる
```

DB確認:

```text
Authentication → Users → 対象ユーザーのEmail confirmed
public.profiles → 対象ユーザーの username / email / role
```

## パスワード再設定テスト

手順:

1. テスターがProduction URLを開く。
2. ログイン画面のメールアドレス欄に登録済みメールを入力する。
3. 「パスワードを忘れた場合」を押す。
4. 再設定メール送信案内が出ることを確認する。
5. メール受信箱を開く。
6. Supabaseからのパスワードリセットメールを開く。
7. リセットリンクを押す。
8. Production URLで新パスワード設定画面が出ることを確認する。
9. 新しいパスワードを入力して更新する。
10. ログイン画面へ戻ることを確認する。
11. 新しいパスワードでログインする。
12. メニュー画面へ入れることを確認する。

OK:

```text
再設定メールが届く
リンク先がProduction URLになる
新パスワード設定画面が出る
新パスワードでログインできる
```

NG:

```text
リンク先がlocalhostになる
新パスワード設定画面が出ない
更新後に旧パスワードでログインできる
```

## 管理者ログイン確認

手順:

1. テスターがProduction URLを開く。
2. Supabase管理者ユーザーでログインする。
3. メニュー画面へ進む。
4. 画面左上に `ADMIN` バッジが出ることを確認する。
5. 管理者ページボタンを押す。
6. 管理者ページが表示されることを確認する。
7. ユーザー管理、ランキング管理、アカウント削除申請などのセクションリンクを押す。
8. 該当セクションへ移動することを確認する。

OK:

```text
ADMINバッジが出る
管理者ページへ入れる
ユーザー一覧が表示される
ページ内リンクとトップへ戻るボタンが動く
```

NG:

```text
管理者なのに管理者ページへ入れない
一般ユーザーで管理者ページへ入れる
一般ユーザーにADMINバッジが出る
```

DB確認:

```text
public.profiles.role = admin
public.profiles.account_status = active
```

## ランキング保存確認

手順:

1. テスターが一般ユーザーでログインする。
2. メニュー画面でゲームセレクトを押す。
3. 任意のパズルを選ぶ。
4. パズルをクリアする。
5. ランキング画面を開く。
6. クリアしたユーザー名と記録が表示されることを確認する。
7. Supabase Table Editorで `ranking_records` を開く。
8. 対象ユーザーの記録が追加されていることを確認する。

OK:

```text
ランキング画面に記録が出る
ranking_records に記録がある
ランキング表示にメールアドレスが出ない
```

NG:

```text
ゲーム上はクリアしたがランキングに出ない
ranking_records に保存されない
profiles のメールアドレスなど非公開情報がランキングに出る
```

DB確認:

```text
public.ranking_records.user_id
public.ranking_records.clear_time_ms
public.public_profiles.username / display_name
```

## パスワードクリア確認

手順:

1. 管理者アカウントでログインする。
2. 管理者ページを開く。
3. 対象ユーザーの詳細を開く。
4. 「パスワードクリア」を押す。
5. 確認モーダルで対象ユーザー名、メールアドレス、ユーザーIDが合っていることを確認する。
6. 「実行する」を押す。
7. Supabaseの `profiles` テーブルを開く。
8. 対象ユーザーの `password_clear_required` が `true` になっていることを確認する。
9. 対象ユーザーでログインする。
10. 新パスワード設定画面が出ることを確認する。
11. 新パスワードを設定する。
12. Supabaseの `profiles` テーブルを再確認する。
13. 対象ユーザーの `password_clear_required` が `false` になり、`last_password_changed_at` が入っていることを確認する。

OK:

```text
password_clear_required が true になる
true の間は通常メニューへ入れない
新パスワード設定後に false へ戻る
```

NG:

```text
password_clear_required が true にならない
true なのに通常メニューへ入れる
新パスワード設定後も false に戻らない
```

## 最終チェック欄

```text
[ ] Vercelタイトル画面表示
[ ] Supabase公開接続設定
[ ] Redirect URLs設定
[ ] 新規登録メール確認
[ ] メール確認後ログイン
[ ] パスワード再設定
[ ] 管理者ログイン
[ ] ADMINバッジ表示
[ ] 管理者ページ表示
[ ] 管理者ページ内リンク
[ ] ランキング保存
[ ] public_profiles経由のランキング表示
[ ] パスワードクリア
[ ] 一般ユーザーで管理者ページ不可
[ ] 一般ユーザーでADMINバッジ非表示
```
