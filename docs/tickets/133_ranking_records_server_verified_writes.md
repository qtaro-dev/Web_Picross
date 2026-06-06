# チケット133：ランキング書き込みのサーバー検証化

## 目的

コードレビューで、認証ユーザーが自分の `ranking_records` 行を直接 insert/update できるため、ブラウザから `clear_time_ms` などを任意値で送信してランキングを改ざんできる可能性が指摘された。

ランキングはゲームの信頼性に関わるため、クライアントからの直接書き込みを禁止または制限し、検証済みのクリア結果だけをサーバーAPI / RPC / service role 経由で保存する方式へ見直す。

## 対象ファイル（推定）

- `docs/supabase/002_rls.sql`
- `docs/supabase/010_ranking_verified_writes.sql`（新規追加候補）
- `js/supabaseProgress.js`
- `js/actions.js`
- `js/config.js`
- `api/*.js`（新規API追加候補）
- `README.md`
- `docs/ticket_status.json`

## 実装内容

### 1. 現在のランキング書き込み経路を確認する

- `ranking_records_insert_own`
- `ranking_records_update_own_or_admin`
- `js/supabaseProgress.js`
- クリア時のランキング保存処理
- 管理者がランキングを扱う処理

上記を確認し、クライアントから任意の `clear_time_ms` を直接保存できる経路を洗い出す。

### 2. 一般ユーザーの直接insert/updateを制限する

- 一般ユーザーが `ranking_records` に直接 `insert/update` できないようにする。
- 管理者は必要に応じて管理操作できるようにする。
- RLSを修正する。
- 本番DBへ適用するSQLを追加する。
  - `docs/supabase/010_ranking_verified_writes.sql`

### 3. 検証済み保存経路を作る

- ランキング保存は、以下のいずれかの方式にする。
  - サーバーAPI経由
  - Supabase RPC経由
  - service roleを使ったVercel API経由
- service_role keyをフロントエンドへ露出しない。
- 保存時に最低限以下を検証する。
  - ログイン中ユーザーと保存対象ユーザーが一致すること
  - puzzle id / difficulty / clear_time_ms が妥当な形式であること
  - clear_time_ms が0や極端に小さい値でないこと
  - 既存ベストタイム更新条件と整合すること
- 完全なチート防止が困難な場合でも、少なくとも直接DB改ざんより安全にする。

### 4. 既存の進行状況保存と分離する

- `user_progress` と `ranking_records` の役割を整理する。
- 進行状況保存は既存仕様を可能な限り維持する。
- ランキング保存だけを検証経路に寄せる。
- 既存ランキング表示が壊れないようにする。

### 5. エラー表示を整理する

- ランキング保存に失敗しても、クリア画面自体が壊れないようにする。
- 保存失敗時は、ランキング保存に失敗したことが分かる表示にする。
- ゲーム進行やクリア状態保存に影響しすぎないようにする。

## 受け入れ条件（目視確認基準）

### 直接DB書き込み防止

- 一般ユーザーでログインする。
- ブラウザやSupabaseクライアント相当で `ranking_records` へ直接insert/updateを試す。
- OK：拒否されること。
- NG：任意の `clear_time_ms` を保存できること。

### 正規クリア時のランキング保存

- 一般ユーザーが問題を正規にクリアする。
- OK：ランキング保存処理が実行されること。
- OK：ランキング画面に反映されること。
- NG：RLS修正により正規クリアでもランキング保存不能になること。

### 異常値拒否

- `clear_time_ms = 0` や極端に小さい値を保存しようとする。
- OK：保存が拒否されること。
- NG：不自然なタイムがランキングに登録されること。

### ランキング表示回帰

- ランキング画面を開く。
- OK：既存ランキングが表示されること。
- OK：難易度別・パズル別表示が従来どおり動くこと。
