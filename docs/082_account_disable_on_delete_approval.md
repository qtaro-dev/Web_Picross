# チケット82: 削除申請承認時にアカウントを利用停止状態にする

## 目的

管理者ページでアカウント削除申請を承認したとき、Supabase Authユーザーを物理削除せず、`profiles` 側に利用停止状態を付与して、そのユーザーがゲームを利用できないようにする。

## 背景

ユーザー側では、ユーザーデータ画面から「アカウント削除申請」を送信できる。

管理者側では、管理者ページで削除申請を確認し、承認・拒否できるようにする予定。

ただし、Supabase Authユーザーの物理削除には強い権限が必要であり、service role key をフロントに出すのは危険。  
そのため、現段階ではAuthユーザーを直接削除せず、`profiles.account_status` を `disabled` にして、ゲーム利用を停止する方式にする。

## 決定方針

このチケットでは、以下の方式を採用する。

```text
物理削除ではなく、利用停止フラグ方式
```

動作イメージ:

```text
testuser2 がアカウント削除申請
↓
管理者ページに「testuser2 から削除申請が届いています」と表示
↓
管理者が「申請許可」
↓
profiles.account_status = disabled
profiles.disabled_at = 現在日時
profiles.disabled_reason = アカウント削除申請承認
↓
testuser2 はログイン後、ゲームを利用できない
```

## 前提

- チケット80で `account_delete_requests` テーブルが追加済みであること
- チケット81で管理者ページに削除申請一覧・承認・拒否UIが追加済みであること
- `profiles` に以下の列を追加済みであること

```sql
alter table public.profiles
add column if not exists account_status text not null default 'active',
add column if not exists disabled_at timestamptz,
add column if not exists disabled_reason text;
```

- service role key はフロントに出さない
- このチケットでは Supabase Auth ユーザーを物理削除しない
- `user_progress` / `play_history` / `ranking_records` は物理削除しない
- 管理者判定は `profiles.role = 'admin'` を使う
- ユーザー名が `admin` で始まるかどうかでは判定しない

## 対象ファイル（推定）

```text
js/admin.js
js/supabaseAuth.js
js/actions.js
js/render.js
js/state.js
js/config.js
styles.css
README.md
docs/ticket_status.json
```

## 実装内容

### 1. 管理者ページの「申請許可」処理を利用停止処理にする

管理者ページで削除申請を承認した場合、以下を更新する。

対象: `account_delete_requests`

```text
status = approved
reviewed_at = 現在日時
reviewed_by = 現在の管理者user_id
admin_note = 入力されている場合は保存
```

対象: `profiles`

```text
account_status = disabled
disabled_at = 現在日時
disabled_reason = アカウント削除申請承認
```

対象ユーザーは、削除申請の `user_id` から特定する。

### 2. 管理者ページの「申請拒否」処理は利用停止しない

管理者が削除申請を拒否した場合は、`account_delete_requests` のみ更新する。

```text
status = rejected
reviewed_at = 現在日時
reviewed_by = 現在の管理者user_id
admin_note = 入力されている場合は保存
```

この場合、`profiles.account_status` は変更しない。

### 3. disabledユーザーをゲーム利用不可にする

ログイン後、またはユーザーデータ読み込み時に、現在ユーザーの `profiles.account_status` を確認する。

```text
account_status = active
→ 通常利用可能

account_status = disabled
→ ゲーム利用不可
```

`disabled` の場合、以下のようなメッセージを表示し、ゲーム画面・セレクト画面・プレイ画面へ進ませない。

表示例:

```text
このアカウントは削除申請が承認され、現在利用停止中です。
管理者へお問い合わせください。
```

### 4. disabledユーザーの保存処理を止める

`account_status = disabled` のユーザーでは、以下の保存処理を実行しない。

```text
user_progress 更新
play_history 追加
ranking_records 追加
ローカル保存の上書き
```

既にログイン中のまま利用停止された場合も、再読込や保存直前で可能な範囲で防止する。

### 5. disabledユーザーの見え方

disabledユーザーがログインした場合、ユーザーデータ画面または専用メッセージ画面で、利用停止状態を表示する。

表示候補:

```text
アカウント状態: 利用停止
利用停止日時: disabled_at
理由: disabled_reason
```

ただし、詳細を出しすぎず、一般ユーザー向けには簡潔な表示でよい。

### 6. 管理者ページに利用停止状態を表示する

管理者ページのユーザー一覧・ユーザー詳細で、`account_status` を確認できるようにする。

表示例:

```text
active: 通常
disabled: 利用停止
```

disabledユーザーは一覧で分かりやすくする。

例:

```text
薄い赤系表示
ステータスラベル表示
```

### 7. 再有効化はこのチケットでは必須にしない

誤って利用停止にした場合の再有効化は、後続チケットで対応してよい。

後続候補:

```text
チケット83: 管理者ページからdisabledユーザーをactiveに戻す機能
```

ただし、実装が簡単で安全にできる場合は、管理者ページに「利用再開」ボタンを追加してもよい。  
その場合も確認ダイアログを必須にする。

### 8. READMEへ運用方針を追記する

READMEに以下を追記する。

```text
アカウント削除申請は、現段階ではAuthユーザーの物理削除ではなく利用停止として扱う
管理者が削除申請を承認すると profiles.account_status が disabled になる
disabledユーザーはゲームを利用できない
service role keyはフロントに出さない
Authユーザーの物理削除は将来のサーバー側処理として検討する
```

## UI仕様

- 管理者ページで削除申請の承認・拒否が分かりやすい
- 承認時に「対象ユーザーが利用停止になる」ことを明示する
- 拒否時に「利用停止にはしない」ことを明示する
- disabledユーザーは管理者ページで見分けやすい
- disabledユーザーがログインした場合、理由が分かるメッセージを表示する
- 既存テーマに合わせる
- スマホ幅でも崩れない

## 確認ダイアログ文言例

### 申請許可

```text
この削除申請を許可します。
対象ユーザーは利用停止状態になり、ゲームを利用できなくなります。
よろしいですか？
```

### 申請拒否

```text
この削除申請を拒否します。
対象ユーザーは引き続きゲームを利用できます。
よろしいですか？
```

## 受け入れ条件

- 管理者が削除申請を許可すると `account_delete_requests.status` が `approved` になる
- 管理者が削除申請を許可すると対象ユーザーの `profiles.account_status` が `disabled` になる
- 管理者が削除申請を許可すると `profiles.disabled_at` が保存される
- 管理者が削除申請を許可すると `profiles.disabled_reason` が保存される
- 管理者が削除申請を拒否すると `account_delete_requests.status` が `rejected` になる
- 拒否時は対象ユーザーの `profiles.account_status` を変更しない
- disabledユーザーはゲーム画面へ進めない
- disabledユーザーはプレイ記録・ランキング記録を保存できない
- disabledユーザーに日本語メッセージが表示される
- 管理者ページのユーザー一覧・詳細で `account_status` を確認できる
- Supabase Authユーザーを物理削除していない
- user_progress / play_history / ranking_records を物理削除していない
- service role key をフロントに出していない
- 一般ユーザーは他人の削除申請を承認・拒否できない
- 既存のログイン・通常プレイ・ランキング表示が壊れていない
- `node --check` が通る
- ビルド番号を +1 する
- `docs/ticket_status.json` にこのチケットを追加し、初期状態を `未修整` にする

## 最終報告

- 変更したファイル
- 申請許可時の更新内容
- 申請拒否時の更新内容
- disabledユーザーの利用制限内容
- disabledユーザーでの保存防止確認
- 管理者ページでの表示内容
- README追記内容
- service role keyを使っていないことの確認
- `docs/ticket_status.json` 更新内容
