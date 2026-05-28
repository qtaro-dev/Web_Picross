# チケット99：profiles公開SELECTポリシーの見直し

## 背景

SupabaseのRLS確認で、主要テーブルはRLS有効になっていることを確認した。

確認済みの主要テーブル:

```text
account_delete_requests
play_history
profiles
puzzles
ranking_records
user_progress
```

一方で、`profiles` テーブルに以下のポリシーが存在している。

```text
policyname: profiles_select_public
roles: {anon, authenticated}
cmd: SELECT
qual: true
```

これは、匿名ユーザーおよびログイン済みユーザーが `profiles` 全体をSELECTできる状態に見える。

`profiles` には、メールアドレス、アカウント状態、停止理由、削除申請カウント、パスワードクリア関連フラグなど、公開に向かない情報が増えている。

Vercel公開前に、`profiles` の公開範囲を見直す必要がある。

## 目的

`profiles` テーブル本体のSELECT権限を、本人および管理者に限定する。

ランキング表示などで一般公開が必要な情報は、`profiles` 本体ではなく、公開してよい列だけを持つ専用Viewまたは取得処理に分離する。

## 対象ファイル

推定対象:

```text
docs/supabase/001_schema.sql
docs/supabase/追加RLS用SQL
js/supabaseAuth.js
js/supabaseProgress.js
js/admin.js
js/render.js
README.md
docs/ticket_status.json
```

## 実装内容

### 1. profiles_select_public の用途を調査する

現在のアプリ内で、`profiles` の公開SELECTに依存している処理を確認する。

確認対象:

```text
ログイン後のプロフィール取得
管理者ページのユーザー一覧
ランキング表示
削除申請表示
ユーザーデータ画面
```

特に、ランキング表示で `username` や `display_name` を取得するために `profiles_select_public` を使っていないか確認する。

### 2. profiles本体のSELECTポリシーを制限する

`profiles` 本体は、以下の方針に変更する。

```text
本人は自分のprofiles行を読める
管理者は全profiles行を読める
匿名ユーザーはprofiles本体を読めない
一般ログインユーザーは他人のprofiles本体を読めない
```

既存ポリシー `profiles_select_public` は削除または置き換える。

想定ポリシー例:

```sql
drop policy if exists profiles_select_public on public.profiles;

create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using ((id = auth.uid()) or is_admin());
```

実際の関数名や列名は既存SQLに合わせる。

### 3. 公開プロフィール情報が必要な場合は専用Viewを作る

ランキングなどで公開表示が必要な場合は、公開してよい列だけを持つViewを作る。

候補:

```text
public_profiles
```

公開してよい列の例:

```text
id
username
display_name
```

公開しない列の例:

```text
email
role
account_status
disabled_reason
disabled_at
delete_request_count
password_clear_required
password_clear_count
last_password_changed_at
```

### 4. アプリ側の参照先を調整する

ランキングや公開表示で `profiles` を直接読んでいる場合は、公開Viewまたは安全な取得処理へ切り替える。

管理者ページは管理者権限で `profiles` 本体を読む。

一般ユーザーのユーザーデータ画面は、自分の `profiles` 行だけを読む。

### 5. 既存機能を壊さない

以下の処理は維持する。

```text
ユーザー登録後のprofiles作成
ログイン後の自分のプロフィール取得
管理者ページのユーザー一覧
ランキング表示
削除申請処理
アカウント停止・復活処理
パスワードクリア状態確認
```

## 受け入れ条件

### RLSポリシー確認

Supabase SQL Editorで `pg_policies` を確認する。

期待結果:

```text
profiles_select_public が存在しない、またはSELECT trueではない
profiles本体は本人または管理者だけがSELECTできる
匿名ユーザーがprofiles本体を全件SELECTできない
```

### 一般ユーザー確認

一般ユーザーでログインする。

期待結果:

```text
自分のユーザーデータ画面を開ける
自分のプロフィール情報が表示される
他人のprofiles本体情報は取得できない
```

### 管理者確認

AdminQtaroでログインして管理者ページを開く。

期待結果:

```text
ユーザー一覧が表示される
ユーザー詳細が表示される
アカウント状態や管理カウントが表示される
```

### ランキング確認

ランキング画面を開く。

期待結果:

```text
ランキングが表示される
表示名またはユーザー名が表示される
メールアドレスなど非公開情報は表示されない
```

## NG条件

```text
匿名ユーザーでprofiles本体が全件読める
一般ユーザーで他人のemailやaccount_statusが読める
管理者ページのユーザー一覧が表示できなくなる
ランキング表示が壊れる
```

## メモ

このチケットは、Vercel公開前の安全性確認として優先度高め。

anon keyをconfigへ追加する前に、`profiles` の公開範囲を絞ること。
