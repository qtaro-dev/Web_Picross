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
→ Site URL / Redirect URLs
```

次のURLを登録します。

```text
https://web-picross.vercel.app/
https://web-picross.vercel.app/**
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
→ APP_BASE_URL
```

`SUPABASE_SECRET_KEY` はチケット104以降の管理者専用サーバーAPIやローカルインポートスクリプトだけで使います。`/api/supabase-config` から返してよいのは `supabaseUrl`、`supabasePublishableKey`、`configured` だけで、`SUPABASE_SECRET_KEY` や `sb_secret_...` は返しません。

`APP_BASE_URL` は管理者再設定メールとメールアドレス変更確認メールのリンク戻り先です。本番では `https://web-picross.vercel.app/` を設定します。

管理者サーバーAPI確認:

```text
GET /api/admin-auth-check
```

OK:

```text
未ログインでは401
一般ユーザーでは403
profiles.role = admin かつ active の管理者では200
```

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
email_change_request_logs
admin_email_repair_logs
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

## メールアドレス変更テスト

手順:

1. 一般ユーザーでProduction URLへログインする。
2. メニュー画面からユーザーデータ画面を開く。
3. 現在のメールアドレス、新しいメールアドレス、新しいメールアドレス確認欄が表示されることを確認する。
4. 新しいメールアドレスと確認欄へ同じ有効なメールアドレスを入力する。メールアドレス変更欄は254文字まで入力できる。`+` を含むGmailエイリアス形式も有効扱いにする。
5. 「メールアドレス変更申請」を押す。
6. 確認メール送信案内が出ることを確認する。
7. Supabaseからの確認メールを開き、Production URLへ戻ることを確認する。
8. 確認完了後に新しいメールアドレスでログインし、ユーザーデータ画面のメールアドレスを確認する。

OK:

```text
確認メール送信案内が表示される
成功時に「メールアドレスの形式を確認してください」が残らない
リンク先がProduction URLになる
新しいメールアドレスでログインできる
profiles.email がAuth側メールアドレスと一致する
```

NG:

```text
管理者ページから他ユーザーのメールアドレスを直接編集できる
secret keyが画面やNetworkレスポンスに表示される
確認メールなしでメールアドレスが変わる
メール送信成功後に形式エラーが表示される
```

送信制限確認:

```text
同一ユーザーで1時間以内に6回メールアドレス変更申請する。
1〜5回目は確認メールが送信される。
6回目は1時間5回までのエラーになり、email_change_request_logs には成功分だけ記録される。
```

ログ保存確認SQL:

```sql
select *
from public.email_change_request_logs
order by requested_at desc
limit 10;
```

OK:

```text
メールアドレス変更申請ごとにログが追加される
target_user_id が対象ユーザーになっている
old_email が変更前メールアドレスになっている
new_email が申請先メールアドレスになっている
request_type が user_email_change になっている
```

NG:

```text
メールは届いているのにログが0件のまま
ログ保存失敗時の原因コードが確認できない
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

## 管理者メール修復確認

手順:

1. Supabase管理者ユーザーでログインする。
2. 管理者ページを開く。
3. 架空メールや不整合があるユーザーを選択する。
4. 「管理者メール修復」欄に有効なメールアドレスを入力する。
5. 「管理者メール修復を実行」を押す。
6. 確認モーダルの対象ユーザー、ユーザーID、現在メール、修復後メールを確認して実行する。

OK:

```text
確認モーダルを経由して実行される
管理者ページのメール欄が新メールアドレスになる
Auth email と profiles.email が一致する
admin_email_repair_logs に修復履歴が追加される
```

NG:

```text
通常のユーザー情報保存だけでメールが変わる
確認なしで即実行される
一般ユーザーがメール修復できる
```

ログ保存確認SQL:

```sql
select *
from public.admin_email_repair_logs
order by repaired_at desc
limit 10;
```

不正メール形式では `メールアドレスの形式を確認してください。` が表示され、Auth email / profiles.email は変更されないことを確認します。既存ユーザーと重複するメールでは `このメールアドレスはすでに別ユーザーで使用されています。` が表示されることを確認します。

## ランキング保存確認

## 管理者パズルJSONアップロード確認

手順:

1. Supabase管理者ユーザーでログインする。
2. 管理者ページを開く。
3. パズル管理セクションで対象難易度を選択する。
4. 対象難易度と同じ `data/*.json` 相当のJSONを選択する。
5. アップロード前チェックを実行する。
6. 件数と先頭プレビューを確認する。
7. 反映実行し、確認モーダルで実行する。

OK:

```text
ファイル選択欄の文字が不自然に切れていない
アップロード前チェックと反映実行がファイル選択欄の下段に表示される
読み込まれた全件をスクロールして確認できる
選択した難易度だけが更新される
puzzles.id はuuidのまま維持される
puzzle_key に beginner00001 などの管理用ID、またはJSON側idが入る
JSONに含まれない同難易度の既存パズルは削除されず is_published=false になる
対象難易度の問題一覧とゲーム開始が動く
```

NG:

```text
ファイル選択欄が狭すぎて文字が途中で切れる
先頭数件しか表示されず残りを確認できない
他難易度まで変更される
puzzles.id が文字列IDに置き換わる
難易度不一致JSONが登録される
不正JSONでDBが一部更新される
```

DB確認:

```sql
select id, difficulty, stage_no, puzzle_key, title, is_published
from public.puzzles
order by difficulty, stage_no
limit 50;
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

## 管理者再設定メール送信確認

手順:

1. 管理者アカウントでログインする。
2. 管理者ページを開く。
3. 対象ユーザーの詳細を開く。
4. 「管理者再設定メール送信」を押す。
5. 再設定メール送信系のボタンが1つだけ表示されていることを確認する。
6. 確認モーダルで対象ユーザー名、メールアドレス、ユーザーIDが合っていることを確認する。
7. 「実行する」を押す。
8. 再設定メールが届くことを確認する。
9. メール内リンクが `https://web-picross.vercel.app/` に戻ることを確認する。
10. Supabaseの `profiles` テーブルを開く。
11. 対象ユーザーの `password_clear_count` と `password_clear_requested_at` が更新されていることを確認する。
12. 対象ユーザーの `password_clear_required` が `true` へ新規設定されていないことを確認する。
13. 対象ユーザーで新しいパスワードを設定する。
14. ログイン画面へ戻ることを確認する。
15. 新しいパスワードでログインする。
16. 通常メニューへ進み、追加のパスワード変更画面が出ないことを確認する。

OK:

```text
再設定メールリンクが本番URLへ戻る
管理者ページの再設定メール送信ボタンが1つだけ
送信回数と送信日時が更新される
password_clear_required が true へ新規設定されない
新パスワードでログイン後に通常メニューへ進める
```

NG:

```text
リンク先がlocalhostになる
旧「パスワード再設定メール送信」ボタンが残っている
メール送信失敗時に送信回数や送信日時だけ更新される
ログイン後に追加のパスワード変更画面が出る
```

## Supabaseメール設定

Supabase Dashboardで次を確認します。

```text
Authentication → Email Templates → Reset password
Authentication → Emails → Templates → Change email address
Authentication → Providers → Email → Email OTP Expiration
```

OK:

```text
Reset passwordメールの件名または本文に Webピクロス と表示される
Change email addressメールの件名または本文に Webピクロス と表示される
本文のリンクに {{ .ConfirmationURL }} が残っている
Email OTP Expiration が 600 秒になっている
```

NG:

```text
Supabase標準文面だけでWebピクロス名がない
再設定リンクまたはメールアドレス変更リンクの有効期限が長いままになっている
```

Change email addressテンプレート例:

```html
<h2>Webピクロス メールアドレス変更の確認</h2>
<p>Webピクロスで、メールアドレス変更の申請が行われました。</p>
<p>以下のボタンから、新しいメールアドレスへの変更を完了してください。</p>
<p><a href="{{ .ConfirmationURL }}">メールアドレス変更を完了する</a></p>
<p>この変更に心当たりがない場合は、このメールを破棄してください。</p>
<p>Webピクロス</p>
```

## 管理者再設定メール送信制限確認

同じ対象ユーザーに対して1時間以内に6回「管理者再設定メール送信」を実行します。

OK:

```text
1〜5回目はメール送信される
6回目は1時間5回までのエラーになる
6回目で password_clear_count と password_clear_requested_at が更新されない
```

NG:

```text
6回目以降もメールが送信される
エラー表示がない
DB状態だけ更新される
```

## 最終チェック欄

```text
[ ] Vercelタイトル画面表示
[ ] Supabase公開接続設定
[ ] Redirect URLs設定
[ ] 新規登録メール確認
[ ] メール確認後ログイン
[ ] パスワード再設定
[ ] ユーザー本人のメールアドレス変更
[ ] 管理者ログイン
[ ] ADMINバッジ表示
[ ] 管理者ページ表示
[ ] 管理者ページ内リンク
[ ] 管理者メール修復
[ ] 管理者パズルJSONアップロード
[ ] ランキング保存
[ ] public_profiles経由のランキング表示
[ ] 管理者ユーザーのランキング除外
[ ] 管理者ページからユーザー別ランキング削除
[ ] 管理者再設定メール送信
[ ] パスワード再設定メールのWebピクロス文面
[ ] メールアドレス変更確認メールのWebピクロス文面
[ ] パスワード再設定リンクの10分有効期限
[ ] メールアドレス変更確認リンクの10分有効期限
[ ] 管理者再設定メールの1時間5回制限
[ ] メールアドレス変更確認メールの1時間5回制限
[ ] ログイン後の追加パスワード変更画面が出ない
[ ] 一般ユーザーで管理者ページ不可
[ ] 一般ユーザーでADMINバッジ非表示
```
