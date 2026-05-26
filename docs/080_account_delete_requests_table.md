# チケット80: アカウント削除申請テーブルと申請保存処理の追加

## 目的

ユーザーデータ画面の「アカウント削除申請」を、画面上の一時表示だけでなくSupabase Databaseへ保存できるようにする。

管理者ページで後から申請一覧を確認できるようにするため、削除申請用テーブルを追加し、申請者の情報・申請日時・申請状態を記録する。

## 背景

チケット79で、アカウント削除は直接削除せず「削除申請を受け付けるだけ」の挙動に変更した。

次に、管理者が申請を確認できるよう、削除申請をDBへ保存する必要がある。

## 前提

- このチケットではAuthユーザーを直接削除しない
- service role key はフロントに出さない
- 削除申請はDBへ保存する
- 実際の承認・拒否・削除処理は後続チケットで行う
- 管理者判定は `profiles.role = 'admin'` を使う

## 対象ファイル（推定）

```text
docs/supabase/001_schema.sql
docs/supabase/002_rls.sql
docs/supabase/005_account_delete_requests.sql
js/supabaseAuth.js
js/actions.js
js/render.js
js/state.js
js/config.js
README.md
docs/ticket_status.json
```

## 実装内容

### 1. account_delete_requests テーブルを追加する

Supabaseに削除申請保存用テーブルを追加する。

テーブル名:

```text
account_delete_requests
```

カラム案:

```text
id uuid primary key default gen_random_uuid()
user_id uuid not null
username text
display_name text
email text
status text not null default 'pending'
requested_at timestamptz not null default now()
reviewed_at timestamptz
reviewed_by uuid
admin_note text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

`status` 候補:

```text
pending   -- 申請中
approved  -- 承認済み
rejected  -- 拒否済み
cancelled -- ユーザー取消済み。必要なら後続で使用
```

### 2. RLSを追加する

RLS方針:

```text
一般ユーザー:
- 自分の削除申請をinsertできる
- 自分の削除申請をselectできる
- 原則update/deleteできない

管理者:
- 全削除申請をselectできる
- status / admin_note / reviewed_at / reviewed_by をupdateできる
```

ただし、フロントだけで管理者更新がRLS上難しい場合は、後続チケットで管理者APIまたはEdge Functionを検討する。

### 3. 削除申請ボタン押下時にDBへ保存する

ユーザーが `削除申請する` を押したら、`account_delete_requests` に1件追加する。

保存項目:

```text
user_id
username
display_name
email
status = pending
requested_at
```

### 4. 重複申請を防ぐ

同じユーザーが何度も申請できないようにする。

方針:

```text
同一user_idでstatus=pendingの申請がある場合、新規作成しない
「すでに削除申請済みです」と表示する
```

DB側でユニーク制約を付けるか、アプリ側で事前確認する。

推奨:

```text
アプリ側でpending申請を確認
可能ならDB側にも部分ユニーク制約を検討
```

### 5. 申請受付メッセージを表示する

成功時:

```text
アカウント削除申請を受け付けました。
管理者確認後に対応します。
```

重複時:

```text
すでにアカウント削除申請済みです。
管理者確認後に対応します。
```

失敗時:

```text
アカウント削除申請の保存に失敗しました。
時間をおいて再度お試しください。
```

### 6. ユーザーデータ画面に申請状態を表示する

削除申請済みの場合、ユーザーデータ画面に状態を表示する。

表示例:

```text
アカウント削除申請: 申請中
申請日時: 2026/05/22 20:30
```

## 受け入れ条件

- `account_delete_requests` テーブルが作成される
- 削除申請時にDBへ1件保存される
- 同一ユーザーのpending重複申請が防止される
- 申請成功時に日本語メッセージが表示される
- 申請済みユーザーには申請状態が表示される
- Authユーザーは直接削除されない
- profilesは直接削除されない
- user_progress / play_history / ranking_recordsは直接削除されない
- service role key をフロントに出していない
- Supabase未設定時に画面が壊れない
- `node --check` が通る
- ビルド番号を +1 する
- `docs/ticket_status.json` にこのチケットを追加し、初期状態を `未修整` にする

## 最終報告

- 変更したファイル
- 追加したSQL
- RLS方針
- 削除申請保存処理
- 重複申請防止仕様
- ユーザーデータ画面の申請状態表示
- `docs/ticket_status.json` 更新内容
