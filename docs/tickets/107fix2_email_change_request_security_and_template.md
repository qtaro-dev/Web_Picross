# チケット107fix2：メールアドレス変更申請の表示整理・送信制限・メール文面改善

## 背景

チケット107で、ユーザーデータ画面から本人がメールアドレス変更申請できる機能が実装済み。

チケット107fix1で、メールアドレス入力欄の文字数制限は50文字から254文字へ修正済み。

その後の本番テストで、以下の挙動を確認した。

- `+` を含むGmailエイリアス形式のメールアドレスを入力できる
- メールアドレス変更申請ボタンを押すと、確認メールは送信される
- メール内リンクから確認すると、メールアドレス変更自体は成功する
- しかし、画面には「メールアドレスの形式を確認してください」というエラー表示が残る

つまり、実処理は成功しているのに、UI上は失敗に見える状態になっている。

また、メールアドレス変更確認メールはSupabase標準文面のままであり、ユーザーから見るとWebピクロスから届いたメールだと分かりにくい。

さらに、パスワード再設定メールでは106fix1で以下の安全制限を追加済み。

- リンク有効時間10分
- 同一ユーザーへの送信は1時間5回まで
- 送信ログ保存

メールアドレス変更確認メールにも、同等の制限を入れる。

## 目的

ユーザー本人によるメールアドレス変更申請について、以下を実現する。

- 成功時に不正な形式エラーを表示しない
- `+` を含むGmailエイリアスなど、有効なメールアドレスを正しく扱う
- 成功時は確認メール送信済みの分かりやすいメッセージを表示する
- メールアドレス変更確認メール送信にも、10分有効・1時間5回制限・送信ログ保存を追加する
- SupabaseのChange email addressメールテンプレートをWebピクロス向けの文面に変更する

## 対象ファイル（推定）

- `api/user-change-email.js`
- `api/_authGuard.js`
- `js/actions.js`
- `js/render.js`
- `js/supabaseAuth.js`
- `js/config.js`
- `docs/supabase/001_schema.sql`
- `README.md`
- `docs/vercel_supabase_production_checklist.md`
- `docs/ticket_status.json`

必要に応じて、現在 `supabase.auth.updateUser({ email })` を呼んでいる箇所を調査し、サーバーAPI経由へ移行すること。

## 実装内容

### 1. 成功時のエラー表示を修正

メールアドレス変更申請が成功した場合は、以下のようなエラー表示を出さない。

```text
メールアドレスの形式を確認してください
```

成功時は、既存エラー表示をクリアしたうえで、成功メッセージを表示する。

表示例：

```text
メールアドレス変更確認メールを送信しました。
メール内のリンクを確認してください。
```

### 2. Gmailエイリアス形式を有効扱いする

以下のような `+` を含むメールアドレスを有効な形式として扱う。

```text
qtaro.dev.project1977+testuser_002@gmail.com
```

以下は引き続きNGにする。

- 空欄
- `@` がない
- ドメイン部がない
- 確認欄と一致しない
- 255文字以上
- 明らかにメールアドレス形式ではない文字列

### 3. メールアドレス変更申請をサーバーAPI経由へ整理

現在、ブラウザ側から直接以下のような処理を呼んでいる場合は、サーバーAPI経由へ変更する。

```js
supabase.auth.updateUser({ email })
```

新規API例：

```text
POST /api/user-change-email
```

認証条件：

- 未ログインは401
- ログイン済み本人のみ実行可能
- 管理者である必要はない
- 他ユーザーのメール変更は不可

リクエスト例：

```json
{
  "newEmail": "qtaro.dev.project1977+testuser_002@gmail.com"
}
```

サーバー側で行うこと：

- ログインユーザーを検証する
- メールアドレス形式と長さを検証する
- 1時間5回制限を確認する
- 問題なければSupabaseのメールアドレス変更確認メールを送信する
- 成功時のみ送信ログを保存する

### 4. 送信回数制限を追加

同一ユーザーのメールアドレス変更申請は、1時間5回までに制限する。

6回目以降はメールを送信せず、分かりやすいエラーを返す。

表示例：

```text
メールアドレス変更確認メールの送信は1時間に5回までです。
時間をおいて再度お試しください。
```

### 5. 送信ログテーブルを追加

パスワード再設定メールの `password_reset_request_logs` と同様に、メールアドレス変更申請用のログテーブルを追加する。

テーブル名案：

```text
email_change_request_logs
```

列案：

```sql
id uuid primary key default gen_random_uuid(),
target_user_id uuid not null references public.profiles(id) on delete cascade,
old_email text,
new_email text not null,
requested_at timestamptz not null default now(),
request_type text not null default 'user_email_change'
```

rate limit用indexを追加する。

```sql
create index if not exists email_change_request_logs_rate_limit_idx
on public.email_change_request_logs (target_user_id, request_type, requested_at desc);
```

RLSを有効化する。

```sql
alter table public.email_change_request_logs enable row level security;
```

このテーブルは管理・監査用であり、通常ユーザーが直接一覧参照できる必要はない。

### 6. リンク有効時間を10分にする

Supabase側の設定として、Email OTP Expirationを600秒にする。

この設定はDashboard操作が必要であり、コードから変更しない。

READMEまたは本番チェックリストに以下を追記する。

```text
Supabase Authの Email OTP Expiration は 600 秒に設定する。
これはパスワード再設定メールとメールアドレス変更確認メールの有効期限を10分にするため。
```

### 7. メールテンプレート改善

Supabase Dashboardで、Change email addressテンプレートをWebピクロス向け文面に変更する手順をドキュメントへ追記する。

対象：

```text
Supabase Dashboard
→ Authentication / Auth
→ Emails
→ Templates
→ Change email address
```

件名案：

```text
【Webピクロス】メールアドレス変更の確認
```

本文案：

```html
<h2>Webピクロス メールアドレス変更の確認</h2>

<p>Webピクロスで、メールアドレス変更の申請が行われました。</p>

<p>以下のボタンから、新しいメールアドレスへの変更を完了してください。</p>

<p>
  <a href="{{ .ConfirmationURL }}">
    メールアドレス変更を完了する
  </a>
</p>

<p>この変更に心当たりがない場合は、このメールを破棄してください。</p>

<p>Webピクロス</p>
```

テンプレート編集はコードからはできないため、READMEまたは本番チェックリストに手順として記載する。

### 8. 既存のメール同期仕様を維持

チケット107で実装済みの以下仕様は維持する。

- メール変更完了後、ログイン時にAuth emailを `profiles.email` へ同期する
- 管理者ページではメール直接編集不可の注記を表示する
- メールアドレス変更は本人のユーザーデータ画面から行う

### 9. ドキュメント・Build更新

以下を更新する。

- `docs/ticket_status.json` に `107fix2` を追加
- READMEにメールアドレス変更申請の送信制限・テンプレート設定を追記
- 本番チェックリストにSupabase側設定項目を追記
- Build番号を更新する

## 受け入れ条件（目視確認基準）

### 成功時の表示

1. 対象ユーザーでログインする
2. ユーザーデータ画面を開く
3. 新しいメールアドレスに以下のようなGmailエイリアスを入力する

```text
qtaro.dev.project1977+testuser_002@gmail.com
```

4. 確認欄にも同じメールアドレスを入力する
5. メールアドレス変更申請ボタンを押す

OK：

```text
確認メール送信済みの成功メッセージが表示される
「メールアドレスの形式を確認してください」は表示されない
確認メールがGmailに届く
```

NG：

```text
メール送信は成功しているのに形式エラーが表示される
成功メッセージとエラーメッセージが同時に表示される
```

### 不正メール形式

以下のような値を入力する。

```text
abc
abc@
@example.com
```

OK：

```text
メールアドレスの形式を確認してください
```

NG：

```text
不正形式なのに確認メール送信処理へ進む
```

### 確認メール文面

届いたメールを見る。

OK：

```text
件名がWebピクロスのメールだと分かる
本文にWebピクロスでのメールアドレス変更確認であることが書かれている
確認リンクの文言が分かりやすい
```

NG：

```text
Supabase標準文面のままで、何のアプリのメールか分かりにくい
```

### リンク遷移

確認メールのリンクを押す。

OK：

```text
https://web-picross.vercel.app/ へ戻る
localhost へ飛ばない
メールアドレス変更が完了する
```

NG：

```text
localhostへ飛ぶ
メールアドレス変更が完了しない
```

### 変更後の同期

1. メール確認完了後、Webピクロスへ戻る
2. ユーザーデータ画面を再読込する
3. 管理者ページでも対象ユーザーを見る

OK：

```text
ユーザーデータ画面の現在メールアドレスが新しいものになる
管理者ページのメール欄にも新メールアドレスが表示される
ログインできる
```

NG：

```text
Auth側とprofiles側でメールアドレスがズレる
ユーザーデータ画面に旧メールアドレスが残る
管理者ページに旧メールアドレスが残る
```

### 1時間5回制限

同一ユーザーで、メールアドレス変更申請を短時間に複数回行う。

OK：

```text
1〜5回目までは送信可能
6回目は送信されず、1時間5回までの制限メッセージが表示される
email_change_request_logs に成功分だけ記録される
```

NG：

```text
6回目以降も送信できる
失敗分まで送信成功としてログ保存される
```

### 10分有効

Supabase Dashboard側で Email OTP Expiration が600秒になっていることを確認する。

OK：

```text
Email OTP Expiration が 600 秒
```

NG：

```text
3600秒など長い有効期限のまま
```

## 備考

このチケットでは、管理者によるメールアドレス直接変更機能は追加しない。

メールアドレス変更は、引き続き本人のユーザーデータ画面から申請する方式とする。

Supabase Dashboardでのメールテンプレート編集とEmail OTP Expiration設定は、コードではなく本番運用手順として扱う。
