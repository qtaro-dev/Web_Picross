# チケット139：public_profiles の Security Definer View 警告対応

## 目的

Supabase Security Advisor で `public.public_profiles` に対して `Security Definer View` 警告が出ている。

`public_profiles` はランキング表示や公開プロフィール表示などで利用される可能性があるため、安易に変更すると一般画面・ランキング画面・管理画面に影響する可能性がある。

現状の公開列・RLS・参照箇所を確認し、必要であれば `security_invoker = true` 化または公開ビュー設計の見直しを行う。

## 対象ファイル（推定）

- `docs/supabase/001_schema.sql`
- `docs/supabase/002_rls.sql`
- `docs/supabase/011_public_profiles_security_invoker.sql`（新規追加候補）
- `js/supabaseProgress.js`
- `js/render.js`
- `js/actions.js`
- `js/admin.js`
- `README.md`
- `docs/ticket_status.json`

## 実装内容

### 1. public_profiles の定義を確認する

- `public.public_profiles` ビューの定義を確認する。
- 公開列が以下のような最小限になっているか確認する。
  - `id`
  - `username`
  - `display_name`
- 以下の情報が含まれていないことを確認する。
  - `email`
  - `role`
  - `account_status`
  - 管理者用カウンタ
  - 削除申請状態
  - 内部管理用項目

### 2. public_profiles の参照箇所を確認する

- フロントエンドやAPI内で `public_profiles` を参照している箇所を確認する。
- ランキング表示、ユーザー表示、お知らせ管理、管理者画面などへの影響を確認する。
- `security_invoker = true` 化しても必要な画面が壊れないか確認する。

### 3. Security Definer View 警告への対応方針を決める

以下のどちらかを採用する。

#### 案A：security_invoker = true 化する

- PostgreSQL 15以降の `security_invoker = true` を使える場合、ビューを利用者権限で評価する。
- 基礎テーブルのRLSが適用されるため、過剰公開を防ぎやすくなる。
- 一般ユーザーやanonが必要な公開列を読めるよう、RLSやビュー定義を確認する。

#### 案B：現状維持し、公開列最小化を確認する

- 影響が大きい場合は、`security_invoker` 化を見送る。
- その場合でも、公開列が最小限であることを確認し、READMEに理由を記載する。
- Security Advisor 警告は既知の注意点として残す。

### 4. SQLマイグレーションを追加する

- 修正する場合は、既存DB適用用SQLを追加する。
- 新規SQLファイル候補：
  - `docs/supabase/011_public_profiles_security_invoker.sql`
- 初期構築用の `001_schema.sql` / `002_rls.sql` も必要に応じて更新する。
- SQLは可能な限り冪等にする。

### 5. 既存仕様を壊さない

- ランキング表示を壊さない。
- 公開プロフィール表示を壊さない。
- 一般ユーザー画面を壊さない。
- 管理者画面を壊さない。
- お知らせ管理を壊さない。
- ログイン、ゲーム選択、実プレイ、エディタを壊さない。
- 既存テーマ・ライブラリ構成を維持する。
- ハードコード文字列は禁止。
- ICommand構造を崩さない。

## 受け入れ条件（目視確認基準）

### Security Advisor確認

- Supabase Security Advisor を確認する。
- OK：`public.public_profiles` の警告が解消される、または未解消理由がREADME等に明記されていること。
- NG：警告内容を確認せず放置すること。

### 公開列確認

- `public_profiles` の列を確認する。
- OK：公開列が `id` / `username` / `display_name` など最小限であること。
- NG：`email` / `role` / `account_status` などが含まれること。

### 未ログイン表示

- 未ログイン状態で公開画面を開く。
- OK：必要な公開情報だけ表示されること。
- NG：プロフィール詳細や内部状態が見えること。

### ランキング表示

- ランキング画面を開く。
- OK：ユーザー名や表示名が従来どおり表示されること。
- NG：ビュー修正によりランキング表示が壊れること。

### 一般ユーザー確認

- 一般ユーザーでログインする。
- OK：通常ゲームが遊べること。
- OK：ランキング表示が見えること。
- NG：一般ユーザー画面が権限エラーになること。

### 管理者確認

- 管理者でログインする。
- OK：管理者画面を開けること。
- OK：ユーザー管理やお知らせ管理が従来どおり使えること。
- NG：ビュー修正により管理画面が壊れること。
