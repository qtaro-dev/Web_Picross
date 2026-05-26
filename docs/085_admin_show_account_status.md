# チケット85: 管理者ページのユーザー一覧・詳細にアカウント状態を表示する

## 目的

管理者ページのユーザー管理画面で、`profiles.account_status` / `disabled_at` / `disabled_reason` を確認できるようにする。

DBには `account_status`, `disabled_at`, `disabled_reason` が存在しているが、管理者ページ上では状態が見えないため、利用停止ユーザーかどうかを管理画面で判断できるようにする。

## 背景

Supabase の `profiles` テーブルには以下の列が追加済み。

```text
account_status
disabled_at
disabled_reason
```

Table Editor上では確認できるが、管理者ページのユーザー一覧・ユーザー詳細には表示されていない。

そのため、削除申請承認後に対象ユーザーが `disabled` になっているか、管理者ページだけでは確認しづらい。

## 前提

- `profiles` に以下の列が存在すること

```text
account_status text
disabled_at timestamptz
disabled_reason text
```

- 管理者判定は `profiles.role = 'admin'` を使う
- service role key はフロントに出さない
- このチケットではAuthユーザーの物理削除は行わない
- このチケットでは利用停止処理そのものではなく、表示改善を行う

## 対象ファイル（推定）

```text
js/admin.js
js/render.js
js/actions.js
js/supabaseAuth.js
styles.css
README.md
docs/ticket_status.json
```

## 実装内容

### 1. 管理者ページのユーザー一覧にアカウント状態列を追加する

管理者ページのユーザー一覧に、以下の列を追加する。

```text
状態
```

表示内容:

```text
account_status = active   → 通常
account_status = disabled → 利用停止
未設定 / null             → 通常扱い
```

内部値をそのまま出すのではなく、日本語表示にする。

表示例:

```text
通常
利用停止
```

### 2. disabledユーザーを見分けやすくする

`account_status = disabled` のユーザー行は、管理者がすぐ分かるようにする。

候補:

```text
薄い赤系の背景
利用停止バッジ
文字色を警告色にする
```

既存テーマに合わせ、派手すぎない表示にする。

### 3. 管理者ページのユーザー詳細に状態情報を追加する

ユーザー詳細セクションに以下を表示する。

```text
アカウント状態
利用停止日時
利用停止理由
```

表示例:

```text
アカウント状態: 通常
```

```text
アカウント状態: 利用停止
利用停止日時: 2026/05/22 21:30
利用停止理由: アカウント削除申請承認
```

`disabled_at` / `disabled_reason` が `NULL` の場合は `-` 表示でよい。

### 4. 管理者ページの検索・フィルターへの影響を確認する

可能であれば、権限フィルターとは別に状態フィルターを追加する。

候補:

```text
全状態
通常
利用停止
```

ただし、UIが複雑になる場合は状態フィルターは後続チケットでもよい。

このチケットで最低限必要なのは、ユーザー一覧・詳細で状態が見えること。

### 5. 表示用データ取得に account_status 系列を含める

管理者ページで `profiles` を取得する処理に、以下の列を含める。

```text
account_status
disabled_at
disabled_reason
```

もし `select('*')` ではなく明示列指定している場合、必ず追加する。

### 6. PostgRESTキャッシュ対策をREADMEに追記する

列追加直後に画面へ反映されない場合があるため、READMEに以下を追記する。

```sql
NOTIFY pgrst, 'reload schema';
```

## UI仕様

- ユーザー一覧で利用停止ユーザーが分かる
- ユーザー詳細で account_status / disabled_at / disabled_reason が確認できる
- disabledユーザーは見分けやすい
- activeユーザーの表示がうるさくなりすぎない
- 既存テーマを壊さない
- スマホ幅でも最低限確認できる

## 受け入れ条件

- 管理者ページのユーザー一覧にアカウント状態が表示される
- `active` は `通常` と表示される
- `disabled` は `利用停止` と表示される
- disabledユーザーの行が見分けやすい
- ユーザー詳細に `アカウント状態` が表示される
- ユーザー詳細に `利用停止日時` が表示される
- ユーザー詳細に `利用停止理由` が表示される
- `disabled_at` / `disabled_reason` が空の場合は `-` 表示になる
- 既存のユーザー一覧・詳細表示が壊れていない
- 既存の権限編集が壊れていない
- 既存の削除申請承認・拒否処理が壊れていない
- service role key をフロントに出していない
- `node --check` が通る
- ビルド番号を +1 する
- `docs/ticket_status.json` にこのチケットを追加し、初期状態を `未修整` にする

## 確認手順

```text
1. 管理者ユーザーでログインする
2. 管理者ページを開く
3. ユーザー一覧に状態列が表示されることを確認
4. activeユーザーが通常表示になることを確認
5. disabledユーザーが利用停止表示になることを確認
6. ユーザー詳細に account_status / disabled_at / disabled_reason 相当の情報が表示されることを確認
```

## 最終報告

- 変更したファイル
- ユーザー一覧に追加した表示項目
- ユーザー詳細に追加した表示項目
- disabledユーザーの見た目
- PostgRESTキャッシュ対策のREADME追記有無
- PC幅での表示確認
- スマホ幅での表示確認
- `docs/ticket_status.json` 更新内容
