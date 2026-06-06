# チケット132：is_admin()で利用停止中管理者を除外する

## 目的

コードレビューで、`public.is_admin()` が `role = 'admin'` のみを見ており、`account_status = 'disabled'` の管理者を除外していないことが指摘された。

フロントやAPI側で停止済み管理者を弾いていても、RLS直アクセスでは管理者扱いが残る可能性があるため、DB側の管理者判定でも停止中アカウントを除外する。

## 対象ファイル（推定）

- `docs/supabase/002_rls.sql`
- `docs/supabase/009_fix_is_admin_disabled.sql`（新規追加候補）
- `js/supabaseAuth.js`
- `js/admin.js`
- `js/config.js`
- `README.md`
- `docs/ticket_status.json`

## 実装内容

### 1. is_admin() の条件を修正する

- `public.is_admin()` の定義を確認する。
- 管理者判定条件に以下を追加する。
  - `role = 'admin'`
  - `coalesce(account_status, 'active') <> 'disabled'`
- `account_status` がNULLの場合は既存ユーザー互換のため `active` 相当として扱う。
- SQL関数の `security definer` や `search_path` 設定がある場合は既存方針を維持する。

### 2. SQLマイグレーションを追加する

- 本番DBへ適用するためのSQLファイルを追加する。
- 新規SQLファイル候補：
  - `docs/supabase/009_fix_is_admin_disabled.sql`
- 既存の `002_rls.sql` も、初期構築用として同じ定義へ修正する。
- SQLは可能な限り冪等にする。

### 3. RLS利用箇所への影響を確認する

- `is_admin()` を使っているRLSポリシー全体を確認する。
- 管理者ページ、お知らせ管理、Storage管理、ユーザー管理に影響が出ないか確認する。
- 停止中管理者だけが拒否されることを確認する。

### 4. 既存仕様を壊さない

- active状態の管理者は従来どおり管理機能を使えること。
- 一般ユーザーは管理者扱いにならないこと。
- 利用停止中ユーザーは管理操作できないこと。
- 既存テーマ・ライブラリ構成を維持する。
- ハードコード文字列は禁止。
- ICommand構造を崩さない。

## 受け入れ条件（目視確認基準）

### active管理者

- `role = 'admin'` かつ `account_status` が `active` またはNULLの管理者でログインする。
- OK：管理者ページを開けること。
- OK：お知らせ管理、ユーザー管理など既存管理機能が使えること。
- NG：active管理者まで管理機能を失うこと。

### disabled管理者

- `role = 'admin'` かつ `account_status = 'disabled'` のユーザーを用意する。
- そのユーザーで管理系操作を試す。
- OK：RLS上も管理者扱いにならないこと。
- OK：管理者専用データのinsert/update/deleteが拒否されること。
- NG：disabled管理者が管理者RLSを通過すること。

### 一般ユーザー

- 一般ユーザーでログインする。
- 管理者専用操作を試す。
- OK：従来どおり拒否されること。
- NG：一般ユーザーが管理者扱いになること。
