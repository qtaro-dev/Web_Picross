# チケット106fix1：パスワード再設定メール導線の本番URL化・文面改善・有効期限短縮・送信回数制限

## 背景

チケット106の本番テストで、管理者ページから対象ユーザーへパスワード再設定メールを送信できることは確認できた。

ただし、以下の問題・改善点が見つかった。

- 再設定メール内リンクが `http://localhost:3000/` に遷移してしまう
- メール差出・本文が Supabase 標準のままで、Webピクロスからのメールだと分かりにくい
- 再設定リンクの有効時間が長すぎる
- 管理者操作による再設定メール送信に、ユーザー単位の短時間連打制限がない

このため、チケット106fix1として、パスワード再設定メール導線を本番運用向けに修正する。

---

## 目的

管理者がパスワードクリアを実行した際に、対象ユーザーへ安全かつ分かりやすいパスワード再設定メールを送信できるようにする。

特に以下を満たすこと。

- 再設定リンクが本番URLへ戻る
- メール本文から Webピクロス の通知だと分かる
- 再設定リンクの有効時間を短くする
- 同一ユーザーへの再設定メール連打を制限する
- 既存のチケット106の動作を壊さない

---

## 対象ファイル（推定）

### アプリ側

- `api/admin-reset-auth-user.js`
- `api/admin-delete-auth-user.js`
- `api/_adminGuard.js`
- `js/admin.js`
- `js/config.js`
- `js/supabaseAuth.js`
- `docs/supabase/*.sql`
- `README.md`

※ 実際の実装箇所は既存構成を確認して判断すること。

### Supabase側設定

- Authentication → URL Configuration
- Authentication → Email Templates → Reset password
- Authentication → Providers → Email

---

## 実装内容

### 1. 再設定メールリンクを本番URLへ戻す

管理者パスワードクリアAPIで、Supabase Auth のパスワード再設定メールを送信する際に、リダイレクト先を明示する。

本番では以下へ戻ること。

```text
https://web-picross.vercel.app/
```

ただし、URLをコード内に直接ハードコードしない。

環境変数を追加して利用する。

```text
APP_BASE_URL=https://web-picross.vercel.app
```

API側では `process.env.APP_BASE_URL` を参照する。

想定例：

```js
const appBaseUrl = process.env.APP_BASE_URL;
```

`APP_BASE_URL` が未設定の場合は、管理者API側で安全にエラーを返すこと。

このとき、ユーザー向けには分かりやすく表示する。

例：

```text
APP_BASE_URL が未設定のため、パスワード再設定メールを送信できません。
```

---

### 2. Supabase URL Configuration を本番向けに修正する

Supabase Dashboardで以下を設定する。

```text
Site URL:
https://web-picross.vercel.app

Redirect URLs:
https://web-picross.vercel.app/
https://web-picross.vercel.app/**
```

ローカル開発も継続する場合は、必要に応じて以下も残す。

```text
http://127.0.0.1:8000/
http://localhost:3000/
```

ただし、本番メールリンクが localhost に向かないことを最優先に確認する。

---

### 3. Reset password メールテンプレートを Webピクロス用に変更する

Supabase Dashboardで以下を編集する。

```text
Authentication
→ Email Templates
→ Reset password
```

件名案：

```text
【Webピクロス】パスワード再設定のご案内
```

本文案：

```html
<h2>Webピクロス パスワード再設定</h2>

<p>Webピクロスでパスワード再設定の手続きが行われました。</p>

<p>以下のリンクから新しいパスワードを設定してください。</p>

<p>
  <a href="{{ .ConfirmationURL }}">
    パスワードを再設定する
  </a>
</p>

<p>このメールに心当たりがない場合は、このメールを破棄してください。</p>

<p>Webピクロス</p>
```

注意：

- `{{ .ConfirmationURL }}` は削除しない
- メール本文に secret key / token / DB情報を出さない
- Supabase標準文面のまま放置しない

---

### 4. 再設定リンクの有効時間を10分に短縮する

Supabase DashboardでメールOTPの有効期限を短縮する。

```text
Authentication
→ Providers
→ Email
→ Email OTP Expiration
```

設定値：

```text
600
```

意味：

```text
600秒 = 10分
```

注意：

この設定がパスワード再設定以外のメール認証にも影響する可能性があるため、変更後は新規登録メールや本人メール変更導線も壊れていないか確認すること。

---

### 5. 管理者パスワードクリアの再送回数制限を追加する

同一対象ユーザーに対して、管理者パスワードクリアによる再設定メール送信を以下に制限する。

```text
1時間以内に5回まで
```

6回目以降は送信しない。

送信しない場合は、以下も行わない。

- Supabase再設定メール送信
- `password_clear_required` の更新
- `password_clear_count` の加算
- `password_clear_requested_at` の更新

表示メッセージ例：

```text
このユーザーへのパスワード再設定メール送信は、1時間に5回までです。しばらく時間をおいてから再実行してください。
```

---

### 6. 回数制限の保存方法

既存の `profiles` に以下の情報がある場合は、それを利用する。

- `password_clear_count`
- `password_clear_requested_at`

ただし、累計カウントだけでは「直近1時間5回」を正確に判定できない場合がある。

その場合は、以下のいずれかで実装する。

#### 推奨案A：専用ログテーブルを追加する

例：

```sql
create table if not exists public.password_reset_request_logs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  request_type text not null default 'admin_password_clear'
);
```

判定条件：

```sql
target_user_id = 対象ユーザーID
request_type = 'admin_password_clear'
requested_at >= now() - interval '1 hour'
```

件数が5以上なら拒否する。

#### 案B：profiles側に直近ウィンドウ用カラムを追加する

例：

- `password_clear_window_started_at`
- `password_clear_window_count`

ただし、今後の監査性を考えると、ログテーブル方式を優先する。

---

### 7. 送信成功時のみ状態を更新する

処理順は必ず以下にする。

1. 管理者権限チェック
2. 対象ユーザー取得
3. 対象ユーザーのメールアドレス確認
4. 直近1時間の送信回数確認
5. Supabaseパスワード再設定メール送信
6. 送信成功後にDB更新
7. 送信ログ保存
8. 管理者画面へ成功表示

Supabaseメール送信が失敗した場合は、DB状態を変更しない。

---

## 受け入れ条件（目視確認基準）

### 1. 本番URL確認

管理者ページで対象ユーザーを選び、パスワードクリアを実行する。

OK：

```text
再設定メールが届く
メール内リンクが https://web-picross.vercel.app/ へ向く
localhost:3000 に飛ばない
```

NG：

```text
localhost:3000 に飛ぶ
リンク先が空
リンククリック後にエラーになる
```

---

### 2. メール文面確認

Gmailで再設定メールを開く。

OK：

```text
件名または本文に Webピクロス と表示される
パスワード再設定メールだと分かる
Supabase標準文面だけではない
```

NG：

```text
Reset your password のみでWebピクロス名がない
何のサービスから来たメールか分からない
```

---

### 3. 有効期限確認

再設定メール受信後、10分以内にリンクを開く。

OK：

```text
新しいパスワード設定画面に進める
```

11分以上経過後に同じリンクを開く。

OK：

```text
リンク期限切れ、または再設定不可になる
```

NG：

```text
1時間近く経っても再設定できる
```

---

### 4. 送信回数制限確認

同じ対象ユーザーに対して、管理者ページから1時間以内に5回パスワードクリアを実行する。

OK：

```text
1〜5回目はメール送信される
```

6回目を実行する。

OK：

```text
送信されない
1時間に5回までというエラー表示が出る
password_clear_count が増えない
password_clear_requested_at が更新されない
```

NG：

```text
6回目以降もメール送信される
エラー表示がない
DB状態だけ更新される
```

---

### 5. 既存106動作確認

管理者がパスワードクリアを実行した後、対象ユーザーが新パスワードを設定する。

OK：

```text
新パスワードでログインできる
password_clear_required が false に戻る
last_password_changed_at が更新される
通常メニューへ進める
```

---

## 補足

このチケットはチケット106の追加修正である。

チケット106で確認済みの「管理者ページから再設定メール送信できる」導線は維持する。

今回の主目的は以下。

```text
localhost遷移の解消
Webピクロス名義のメール文面化
再設定リンク有効期限10分化
同一ユーザーへの1時間5回制限
```
