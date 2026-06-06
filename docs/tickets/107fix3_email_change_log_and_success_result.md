# チケット107fix3：メールアドレス変更確認メールの成功判定と送信ログ保存修正

## 背景

チケット107fix2で、ユーザー本人によるメールアドレス変更申請をサーバーAPI経由に変更し、以下の機能を追加した。

- `/api/user-change-email` の追加
- 本人Bearerトークン検証
- メールアドレス変更確認メールの送信
- `email_change_request_logs` による送信ログ保存
- 同一ユーザーの1時間5回制限
- `+` を含むGmailエイリアス形式の許可
- 成功時に形式エラーを残さない表示整理

しかし本番確認で、以下の挙動を確認した。

- 「メールアドレス変更申請」ボタンを押す
- Gmailにはメールアドレス変更確認メールが届く
- しかし画面には以下の失敗メッセージが表示される

```text
メールアドレス変更確認メールの送信に失敗しました。時間をおいて再度お試しください。
```

また、Supabase SQL Editorで以下を確認したところ、`email_change_request_logs` は0件だった。

```sql
select *
from public.email_change_request_logs
order by requested_at desc
limit 10;
```

つまり、メール送信自体は成功しているが、送信ログ保存またはAPI成功判定のどこかで失敗し、画面上は失敗扱いになっている可能性が高い。

## 目的

メールアドレス変更確認メールの送信成功時に、画面が正しく成功表示となり、`email_change_request_logs` に送信ログが保存されるように修正する。

また、1時間5回制限がログ保存に基づいて正しく機能するようにする。

## 対象ファイル（推定）

- `api/user-change-email.js`
- `api/_authGuard.js`
- `js/supabaseAuth.js`
- `js/actions.js`
- `js/render.js`
- `js/config.js`
- `docs/supabase/001_schema.sql`
- `docs/supabase/002_rls.sql`
- `README.md`
- `docs/vercel_supabase_production_checklist.md`
- `docs/ticket_status.json`

## 実装内容

### 1. `/api/user-change-email` の処理順を確認・修正する

メールアドレス変更確認メール送信APIの処理を確認し、以下の流れに整理する。

推奨処理順：

```text
1. Bearer tokenを検証してログインユーザーを特定
2. newEmailを検証
3. service role / secret key 側クライアントで、直近1時間の送信ログ件数を確認
4. 5回以上ならメール送信せず429相当で拒否
5. Supabase Authのメール変更確認メールを送信
6. 送信成功後、service role / secret key 側クライアントで email_change_request_logs にinsert
7. insert成功後、成功レスポンスを返す
```

### 2. 送信ログ保存に service role / secret key を使う

`email_change_request_logs` は監査・rate limit用のテーブルであるため、ログ保存はブラウザ側やユーザー権限ではなく、サーバー側の秘密キーを使って行う。

以下のような問題がないか確認する。

- ユーザー権限のSupabaseクライアントで `email_change_request_logs` へinsertしようとしていないか
- RLSによりinsertが拒否されていないか
- insertエラーが握りつぶされていないか
- insert失敗時にメール送信成功まで失敗扱いになっていないか

修正方針：

```text
ログ件数確認とログinsertは、SUPABASE_SECRET_KEY を使うサーバー側クライアントで実行する。
SUPABASE_SECRET_KEY はブラウザへ出さない。
```

### 3. メール送信成功とログ保存成功の扱いを明確化する

理想挙動：

```text
メール送信成功
ログ保存成功
→ 成功レスポンス
```

ログ保存に失敗した場合は、rate limitが効かなくなるため、原則としてエラー扱いにしてよい。

ただし、現在のように「メールは届いているのに画面では失敗」となるとユーザーが混乱するため、少なくともAPIレスポンスには原因を区別できる内部エラー情報を持たせる。

画面表示では、以下のどちらかに整理する。

推奨：

```text
ログ保存まで成功した場合のみ成功表示。
ログ保存失敗時は、管理者/開発者が原因を追えるよう console.error に詳細を出す。
```

ただし、ユーザー向けには秘密情報を出さない。

### 4. 成功時の画面表示を修正する

メール送信とログ保存が成功した場合、画面には以下のような成功メッセージを表示する。

```text
メールアドレス変更確認メールを送信しました。
メール内のリンクを確認してください。
```

このとき、以下の失敗メッセージや形式エラーを表示しない。

```text
メールアドレス変更確認メールの送信に失敗しました。時間をおいて再度お試しください。
メールアドレスの形式を確認してください。
```

### 5. 失敗時のメッセージを分ける

API側のレスポンスに応じて、最低限以下を出し分ける。

#### 未ログイン

```text
ログイン状態を確認できませんでした。再ログインしてください。
```

#### 1時間5回制限

```text
メールアドレス変更確認メールの送信は1時間に5回までです。
時間をおいて再度お試しください。
```

#### メール形式不正

```text
メールアドレスの形式を確認してください。
```

#### その他

```text
メールアドレス変更確認メールの送信に失敗しました。
時間をおいて再度お試しください。
```

### 6. SQL / RLSを再確認する

現在のSQLは以下の内容で適用済み。

```sql
create table if not exists public.email_change_request_logs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  old_email text,
  new_email text not null,
  requested_at timestamptz not null default now(),
  request_type text not null default 'user_email_change'
);

create index if not exists email_change_request_logs_rate_limit_idx
on public.email_change_request_logs (target_user_id, request_type, requested_at desc);

alter table public.email_change_request_logs enable row level security;

drop policy if exists "email_change_request_logs_select_admin" on public.email_change_request_logs;

create policy "email_change_request_logs_select_admin"
on public.email_change_request_logs
for select
to authenticated
using (public.is_admin());

comment on table public.email_change_request_logs is 'Audit and rate-limit log for user requested Supabase Auth email change confirmation mails.';

notify pgrst, 'reload schema';
```

この状態で、サーバーAPIがservice role / secret keyでログinsertする設計なら、通常ユーザー向けinsert policyは不要。

もし実装上どうしても通常のauthenticated clientでinsertする設計になっている場合は、設計を見直し、サーバー側secret keyで行うよう修正すること。

### 7. ログ保存確認用の本番チェック手順を追記

READMEまたは本番チェックリストに、以下の確認SQLを追記する。

```sql
select *
from public.email_change_request_logs
order by requested_at desc
limit 10;
```

期待結果：

```text
メールアドレス変更申請成功後、1件以上ログが追加される。
old_email と new_email が確認できる。
```

### 8. Build / ticket_status 更新

以下を更新する。

- `js/config.js` のBuild番号
- `docs/ticket_status.json` に `107fix3` を追加
- README / 本番チェックリストに確認内容を追記

## 受け入れ条件（目視確認基準）

### メール送信成功時

1. 対象ユーザーでログインする
2. ユーザーデータ画面を開く
3. 新しいメールアドレス欄にGmailエイリアスを入力する

```text
qtaro.dev.project1977+testuser_004@gmail.com
```

4. 確認欄にも同じメールアドレスを入力する
5. 「メールアドレス変更申請」を押す

OK：

```text
メールアドレス変更確認メールを送信しました。
メール内のリンクを確認してください。
```

NG：

```text
メールは届いているのに「送信に失敗しました」と表示される
メールは届いているのに「メールアドレスの形式を確認してください」と表示される
```

### メール受信

1. Gmailを開く
2. 新しいメールアドレス宛の確認メールを見る

OK：

```text
確認メールが届いている
Webピクロスのメールだと分かる文面になっている
確認リンクが表示されている
```

### 送信ログ保存

Supabase SQL Editorで以下を実行する。

```sql
select *
from public.email_change_request_logs
order by requested_at desc
limit 10;
```

OK：

```text
メールアドレス変更申請ごとにログが追加される
target_user_id が対象ユーザーになっている
old_email が変更前メールアドレスになっている
new_email が申請先メールアドレスになっている
request_type が user_email_change になっている
```

NG：

```text
メールは届いているのにログが0件のまま
ログinsertエラーで画面が失敗扱いになる
```

### 1時間5回制限

同じユーザーで短時間に6回メールアドレス変更申請を行う。

OK：

```text
1〜5回目までは送信できる
6回目は送信されない
1時間5回までの制限メッセージが表示される
email_change_request_logs には成功分だけ記録される
```

NG：

```text
6回目以降も送信できる
ログが記録されないため制限が効かない
```

### 不正メール形式

以下のようなメールアドレスを入力する。

```text
abc
abc@
@example.com
```

OK：

```text
メールアドレスの形式を確認してください。
メールは送信されない
ログも保存されない
```

### 確認リンク後

1. 確認メールのリンクを押す
2. Webピクロスに戻る
3. ユーザーデータ画面を再読込する
4. 管理者ページでも対象ユーザーを見る

OK：

```text
ユーザーデータ画面の現在メールアドレスが新しいメールアドレスになる
管理者ページのメール欄にも新しいメールアドレスが反映される
```

## 備考

このチケットは、メールアドレス変更確認メールのテンプレート改善そのものではなく、送信成功判定と送信ログ保存の不整合修正を目的とする。

Supabase Dashboard側のEmail OTP Expiration 600秒設定とChange email addressテンプレート設定は、107fix2の運用項目として引き続き維持する。
