# チケット86: 管理者ページから利用停止ユーザーを復活できる機能

## 目的

削除申請を承認して `account_status = disabled` になったユーザーを、管理者ページから `active` に戻せるようにする。

誤って削除申請を承認した場合や、ユーザーから再利用希望があった場合に、Supabase Table Editorを直接触らずアプリ上で復旧できるようにする。

## 背景

現在は、アカウント削除申請を管理者が承認すると、対象ユーザーの `profiles.account_status` が `disabled` になり、ゲームを利用できない状態になる。

ただし、利用停止を解除する導線がないため、誤操作時の復旧や再開対応がしづらい。

## 前提

- 物理削除ではなく、利用停止フラグ方式を継続する
- Supabase Authユーザーは削除しない
- `user_progress` / `play_history` / `ranking_records` は削除しない
- 管理者判定は `profiles.role = 'admin'` を使う
- service role key はフロントに出さない
- 復活操作は管理者ページからのみ行う
- 復活対象は `profiles.account_status = disabled` のユーザー

## 対象ファイル（推定）

```text
js/admin.js
js/render.js
js/actions.js
js/supabaseAuth.js
styles.css
README.md
docs/supabase/001_schema.sql
docs/supabase/004_profiles_email_migration.sql
docs/ticket_status.json
```

## 実装内容

### 1. 管理者ページのユーザー詳細に「利用停止解除」ボタンを追加する

管理者ページでユーザー詳細を開いたとき、対象ユーザーが `disabled` の場合のみ以下のボタンを表示する。

```text
利用停止解除
```

表示条件:

```text
profiles.account_status === 'disabled'
```

非表示条件:

```text
profiles.account_status !== 'disabled'
一般ユーザー
未ログイン
ローカルユーザー
```

### 2. 利用停止解除の確認ダイアログを追加する

ボタン押下時に確認ダイアログを表示する。

文言例:

```text
このユーザーの利用停止を解除します。
対象ユーザーは再びゲームを利用できるようになります。
よろしいですか？
```

ボタン:

```text
キャンセル
解除する
```

### 3. profilesをactiveに戻す

確認後、対象ユーザーの `profiles` を更新する。

更新内容:

```text
account_status = active
disabled_at = null
disabled_reason = null
```

チケット87のSQL適用後は、以下も同時に更新する。

```text
account_reactivated_count = account_reactivated_count + 1
last_reactivated_at = 現在日時
```

### 4. 削除申請履歴は残す

`account_delete_requests` の履歴は削除しない。

承認済み申請はそのまま残す。

```text
account_delete_requests.status = approved のまま
```

必要であれば、管理者メモに「利用停止解除済み」などを追記する処理を検討してよいが、このチケットでは必須ではない。

### 5. 利用停止解除後の画面更新

解除成功後、管理者ページのユーザー一覧・ユーザー詳細を再取得する。

表示更新:

```text
状態: 利用停止 → 通常
利用停止日時: - 
利用停止理由: -
```

### 6. disabledユーザーで再ログイン確認

復活後、対象ユーザーが再ログインまたは再読み込みしたときに、ゲームを利用できることを確認する。

## UI仕様

- disabledユーザーにだけ「利用停止解除」ボタンが表示される
- activeユーザーには表示しない
- 誤操作防止の確認ダイアログを必ず出す
- 解除成功時は日本語メッセージを表示する
- 既存テーマに合わせる
- 危険操作ではないが管理操作なので目立ちすぎないデザインにする

## 受け入れ条件

- 管理者ページで disabled ユーザー詳細を開くと「利用停止解除」ボタンが表示される
- active ユーザーには「利用停止解除」ボタンが表示されない
- 一般ユーザーには利用停止解除操作が表示されない
- 解除前に確認ダイアログが表示される
- 解除を実行すると `profiles.account_status` が `active` になる
- 解除を実行すると `profiles.disabled_at` が `null` になる
- 解除を実行すると `profiles.disabled_reason` が `null` になる
- 解除後、管理者ページの表示が通常状態に更新される
- 解除後、対象ユーザーがゲームを利用できる
- Authユーザーは物理削除・再作成しない
- 進行データ・履歴・ランキングは削除しない
- service role key をフロントに出していない
- `node --check` が通る
- ビルド番号を +1 する
- `docs/ticket_status.json` にこのチケットを追加し、初期状態を `未修整` にする

## CODEXへのSQL提示依頼

実装時、CODEXは以下を確認し、必要であればSQLを提示すること。

```text
profiles に account_reactivated_count / last_reactivated_at が存在するか
存在しない場合、チケット87で使う集計列追加SQLを提示する
```

ただし、SQLはCODEXが直接実行しない。  
提示されたSQLはユーザーがSupabase SQL Editorで実行する。

## 最終報告

- 変更したファイル
- 追加した利用停止解除UI
- 解除時のprofiles更新内容
- 確認ダイアログ文言
- 解除後の表示更新確認
- disabledユーザー復活確認
- 必要SQLの有無
- `docs/ticket_status.json` 更新内容
