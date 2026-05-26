# チケット87: 削除申請・承認・拒否・停止・復活の回数カウントを追加する

## 目的

アカウント削除申請まわりの操作履歴を、管理者ページで分かりやすく確認できるようにする。

削除申請回数、承認回数、拒否回数、利用停止回数、復活回数、最新日時を `profiles` に集計値として持たせ、管理者ページに表示する。

## 背景

`account_delete_requests` には削除申請の履歴が残るが、管理者ページのユーザー一覧・詳細で毎回履歴を集計するのは扱いづらい。

そのため、詳細履歴は `account_delete_requests` に残しつつ、一覧や詳細で見たい集計値は `profiles` に保持する。

## 決定方針

```text
詳細履歴:
account_delete_requests に残す

集計値:
profiles に持たせる
```

この方式により、管理者ページのユーザー一覧・詳細で以下をすぐ確認できる。

```text
削除申請回数
削除申請承認回数
削除申請拒否回数
利用停止回数
利用停止解除回数
最終削除申請日時
最終利用停止日時
最終復活日時
```

## 前提

- 物理削除ではなく利用停止フラグ方式を継続する
- `account_delete_requests` は履歴として残す
- 管理者判定は `profiles.role = 'admin'`
- service role key はフロントに出さない
- SQLはCODEXが提示し、ユーザーがSupabase SQL Editorで実行する
- CODEXはSQLを直接実行しない

## 対象ファイル（推定）

```text
docs/supabase/001_schema.sql
docs/supabase/004_profiles_email_migration.sql
docs/supabase/005_account_delete_requests.sql
js/admin.js
js/render.js
js/actions.js
js/supabaseAuth.js
styles.css
README.md
docs/ticket_status.json
```

## CODEXに提示させるSQL

`profiles` に以下の列を追加するSQLをCODEXから提示すること。

```sql
alter table public.profiles
add column if not exists delete_request_count integer not null default 0,
add column if not exists delete_approved_count integer not null default 0,
add column if not exists delete_rejected_count integer not null default 0,
add column if not exists account_disabled_count integer not null default 0,
add column if not exists account_reactivated_count integer not null default 0,
add column if not exists last_delete_requested_at timestamptz,
add column if not exists last_disabled_at timestamptz,
add column if not exists last_reactivated_at timestamptz;
```

SQL提示後、ユーザーがSupabase SQL Editorで実行する。  
実行後に必要であれば以下も実行するようREADMEに記載する。

```sql
NOTIFY pgrst, 'reload schema';
```

確認SQLも提示すること。

```sql
select
  username,
  delete_request_count,
  delete_approved_count,
  delete_rejected_count,
  account_disabled_count,
  account_reactivated_count,
  last_delete_requested_at,
  last_disabled_at,
  last_reactivated_at
from public.profiles
order by username;
```

## 実装内容

### 1. 削除申請時にカウントを増やす

一般ユーザーがアカウント削除申請を行い、`account_delete_requests` に pending レコードを作成できた場合、対象ユーザーの `profiles` を更新する。

更新内容:

```text
delete_request_count = delete_request_count + 1
last_delete_requested_at = 現在日時
```

重複申請を防止している場合、既に pending があるときはカウントを増やさない。

### 2. 申請承認時にカウントを増やす

管理者が削除申請を承認した場合、対象ユーザーの `profiles` を更新する。

更新内容:

```text
delete_approved_count = delete_approved_count + 1
account_disabled_count = account_disabled_count + 1
last_disabled_at = 現在日時
account_status = disabled
disabled_at = 現在日時
disabled_reason = アカウント削除申請承認
```

同じ申請を二重承認した場合にカウントが増えないようにする。

条件:

```text
account_delete_requests.status が pending の場合のみ承認処理を実行する
approved / rejected 済みの場合はカウントしない
```

### 3. 申請拒否時にカウントを増やす

管理者が削除申請を拒否した場合、対象ユーザーの `profiles` を更新する。

更新内容:

```text
delete_rejected_count = delete_rejected_count + 1
```

同じ申請を二重拒否した場合にカウントが増えないようにする。

条件:

```text
account_delete_requests.status が pending の場合のみ拒否処理を実行する
approved / rejected 済みの場合はカウントしない
```

### 4. 利用停止解除時にカウントを増やす

チケット86の利用停止解除時に、対象ユーザーの `profiles` を更新する。

更新内容:

```text
account_reactivated_count = account_reactivated_count + 1
last_reactivated_at = 現在日時
account_status = active
disabled_at = null
disabled_reason = null
```

すでに active のユーザーに対してはカウントしない。

### 5. 管理者ページにカウント表示を追加する

管理者ページのユーザー詳細に、以下の項目を表示する。

```text
削除申請回数
申請承認回数
申請拒否回数
利用停止回数
利用停止解除回数
最終削除申請日時
最終利用停止日時
最終復活日時
```

表示例:

```text
削除申請回数: 1
申請承認回数: 1
申請拒否回数: 0
利用停止回数: 1
利用停止解除回数: 0
最終削除申請日時: 2026/05/23 13:25
最終利用停止日時: 2026/05/23 13:32
最終復活日時: -
```

### 6. ユーザー一覧で最低限のカウントを表示する

管理者ページのユーザー一覧には、スペースに余裕があれば以下を表示する。

```text
削除申請回数
利用停止回数
復活回数
```

画面が狭くなる場合は、ユーザー詳細のみでもよい。  
ただし、詳細には必ず表示する。

### 7. 既存ユーザーの初期値

既存ユーザーは、SQL追加時の default 0 により以下になる。

```text
delete_request_count = 0
delete_approved_count = 0
delete_rejected_count = 0
account_disabled_count = 0
account_reactivated_count = 0
```

既存の `account_delete_requests` 履歴から再集計する処理は、このチケットでは必須ではない。

必要になったら別チケットで行う。

## UI仕様

- 管理者ページのユーザー詳細で回数が分かる
- 日時が未設定の場合は `-` 表示
- カウントは0でも表示する
- disabled状態表示と近い場所に置く
- 既存テーマに合わせる
- スマホ幅でも最低限確認できる

## 受け入れ条件

- CODEXが必要なSQLを提示する
- ユーザーがSQLを実行後、アプリ側でカウント列を扱える
- 削除申請成功時に `delete_request_count` が1増える
- 削除申請成功時に `last_delete_requested_at` が更新される
- 重複pending申請では `delete_request_count` が増えない
- 申請承認時に `delete_approved_count` が1増える
- 申請承認時に `account_disabled_count` が1増える
- 申請承認時に `last_disabled_at` が更新される
- 二重承認ではカウントが増えない
- 申請拒否時に `delete_rejected_count` が1増える
- 二重拒否ではカウントが増えない
- 利用停止解除時に `account_reactivated_count` が1増える
- 利用停止解除時に `last_reactivated_at` が更新される
- activeユーザーに解除操作してもカウントが増えない
- 管理者ページのユーザー詳細に各カウントと日時が表示される
- service role key をフロントに出していない
- 既存の削除申請・承認・拒否・利用停止処理が壊れていない
- `node --check` が通る
- ビルド番号を +1 する
- `docs/ticket_status.json` にこのチケットを追加し、初期状態を `未修整` にする

## CODEXへのSQL実行ルール

- CODEXはSQLを提示するだけでよい
- SQLを直接実行したと報告しない
- ユーザーがSupabase SQL Editorで実行する前提にする
- SQL適用後に必要な確認SQLも提示する

## 最終報告

- 変更したファイル
- 提示したSQL
- SQL実行後に必要な確認手順
- 削除申請時のカウント更新内容
- 承認時のカウント更新内容
- 拒否時のカウント更新内容
- 復活時のカウント更新内容
- 管理者ページに追加した表示項目
- 二重カウント防止の実装内容
- `docs/ticket_status.json` 更新内容
