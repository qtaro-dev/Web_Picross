# チケット138：GitHub公開前提のsecret混入・Supabase公開アクセス監査

## 目的

Web_Picross はGitHubにコードを公開しており、第三者がリポジトリをcloneしてローカル起動できる可能性がある。

フロントエンドに含まれる `SUPABASE_URL` や `SUPABASE_PUBLISHABLE_KEY` / `anon key` は、RLSが正しく設定されていれば公開前提で扱えるが、`SUPABASE_SECRET_KEY` / `service_role key` / `sb_secret` / DBパスワードなどがGitHub上に混入している場合は重大な漏えいになる。

また、公開キーだけでもRLSに穴がある場合、ローカル起動や直接APIアクセスから本番Supabaseデータへ不正アクセスされる可能性がある。

そのため、GitHub公開前提で安全に運用できるかを、secret混入・RLS・公開テーブル・公開Storageの観点から監査する。

## 対象ファイル（推定）

プロジェクト全体を対象にする。

重点対象：

- `index.html`
- `server.js`
- `api/*.js`
- `js/*.js`
- `data/*.json`
- `docs/**/*.md`
- `docs/**/*.sql`
- `README.md`
- `.gitignore`
- `.env*`
- `package.json`
- `vercel.json`
- その他、リポジトリ内の全ファイル

## 実装内容

### 1. secret混入の全体検索

リポジトリ内に秘密情報が含まれていないか確認する。

検索対象例：

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SERVICE_ROLE`
- `service_role`
- `sb_secret`
- `JWT_SECRET`
- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `DB_PASSWORD`
- `anon`
- `eyJ`
- `sk_`
- `password`
- `secret`
- `token`
- `private`
- `apikey`
- `api_key`

注意：

- `SUPABASE_PUBLISHABLE_KEY` / `anon key` は、RLSが正しければ公開前提の可能性がある。
- ただし、値の種類を必ず確認する。
- `sb_secret_` や service_role key が見つかった場合はCritical扱いにする。
- `eyJ` はJWT形式の誤検出も多いため、実値かサンプルかを確認する。
- READMEやdocs内に実キーを貼っていないか確認する。
- 過去に使ったテスト用メモ、SQL、コメント内も確認する。

### 2. .gitignore確認

以下がGit管理対象外になっているか確認する。

- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- `.env.*`
- `*.key`
- `*.pem`
- 秘密情報メモ
- ローカル設定ファイル
- ローカルユーザーデータ
- 一時ログ

必要に応じて `.gitignore` を修正する。

### 3. フロントエンドに出てよいキー・出てはいけないキーを整理する

フロントエンドに含まれてよいもの：

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- Supabase anon/public key

フロントエンドに含めてはいけないもの：

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `sb_secret_*`
- DB接続文字列
- DBパスワード
- JWT secret
- 管理用API token
- Vercel secret
- GitHub token

上記の区別をREADMEまたは開発メモへ追記する。

### 4. Vercel API側のsecret利用確認

- `api/*.js` で `SUPABASE_SECRET_KEY` などを使っている箇所を確認する。
- secretは必ず `process.env` から取得していること。
- secret値をコードに直接書いていないこと。
- secret値をレスポンスやconsole出力に含めていないこと。
- APIエラー時にsecretが漏れないこと。
- service roleを使うAPIが、認証・権限チェックを必ず行っていること。

重点確認対象：

- `api/resolve-login-email.js`
- `api/save-ranking-record.js`
- その他 `api/*.js`

### 5. Supabase RLS前提の公開アクセス監査

公開キーだけでアクセスされた場合に、以下が守られているか確認する。

未ログインで許可してよいもの：

- 公開済みお知らせ記事の読み取り
- 公開パズルデータの読み取り
- 必要最低限の公開プロフィール情報

未ログインで許可してはいけないもの：

- `profiles` 全件の直接読み取り
- メールアドレスの読み取り
- role / account_status の読み取り
- 非公開お知らせ記事の読み取り
- ランキングや進捗の不正更新
- Storageへのアップロード・削除
- 管理者用ログの読み取り

ログイン済み一般ユーザーに許可してよいもの：

- 自分の進捗読み取り・保存
- 自分に紐づく必要最低限のプロフィール読み取り
- 正規フロー内で許可された操作

ログイン済み一般ユーザーに許可してはいけないもの：

- 自分の `role` / `account_status` / `email` / 管理カウンタの直接更新
- 他ユーザーのプロフィール詳細読み取り
- 他ユーザーの進捗更新
- `ranking_records` の直接insert/update
- 管理者向けテーブルの操作

### 6. public_profilesビューの確認

Supabase Security Advisorで `public.public_profiles` の `Security Definer View` 警告が出ているため、確認する。

- `public_profiles` がどの列を公開しているか確認する。
- メールアドレスや内部状態が含まれていないか確認する。
- `security_definer` が必要な設計か確認する。
- 可能であれば `security_invoker = true` へ変更できるか検討する。
- 変更が必要な場合は、別チケット化するか、このチケット内で最小修正する。

注意：

- `public_profiles` の変更は一般ユーザー表示やランキング表示に影響する可能性がある。
- 影響が大きい場合は、このチケットでは監査のみとし、修正は別チケットに分ける。

### 7. Storage公開範囲の確認

- `news-images` bucket がpublicであることを確認する。
- 公開お知らせ画像として許容するか確認する。
- 下書き画像・未使用画像・誤アップロード画像もURLを知っていれば読める状態か確認する。
- 管理者以外がアップロード・削除できないことを確認する。
- 必要に応じて以下の方針を提案する。
  - public bucket継続
  - private bucket + signed URL
  - 公開済み記事に紐づく画像だけ公開
  - 未使用画像の削除運用

### 8. cloneしてローカル起動された場合の影響を整理する

第三者がGitHubからcloneしてローカル起動した場合に、何ができるかを整理する。

確認観点：

- 本番Supabaseへ接続できるか
- 未ログインで何が読めるか
- 一般ユーザー登録・ログインで何ができるか
- 管理者操作に到達できないか
- service role相当の操作ができないか
- ローカル `server.js` 経由で本番DBに危険な操作ができないか

結果をREADMEまたは監査メモにまとめる。

### 9. 必要なら修正する

監査で明確な問題が見つかった場合は、最小限の修正を行う。

修正例：

- `.gitignore` 追加
- READMEのsecret扱い説明追加
- secret値のconsole出力削除
- APIレスポンスの秘匿化
- 誤って含まれたsecretサンプルの削除
- public_profilesの公開列削減
- RLSの不足修正

ただし、影響が大きいRLS変更・Storage設計変更・ビュー設計変更は、別チケット化してもよい。

### 10. 既存仕様を壊さない

- ログイン、ユーザー登録、パスワード再設定、確認メール再送を壊さない。
- 管理者画面を壊さない。
- お知らせ管理を壊さない。
- ランキング保存を壊さない。
- ゲーム本体を壊さない。
- エディタを壊さない。
- 既存テーマ・ライブラリ構成を維持する。
- ハードコード文字列は禁止。
- ICommand構造を崩さない。

## 受け入れ条件（目視確認基準）

### secret混入確認

- リポジトリ全体を検索する。
- OK：`SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `sb_secret` / DBパスワードなどの実値が含まれていないこと。
- OK：secretはVercel環境変数またはローカル未追跡 `.env` で管理されていること。
- NG：GitHubに公開されるコード・README・docsにsecret実値が含まれていること。

### 公開キー確認

- フロントエンドに含まれるSupabaseキーを確認する。
- OK：publishable / anon keyのみであること。
- OK：service_role系ではないこと。
- NG：フロントJSにservice_role keyが含まれること。

### .gitignore確認

- `.env*` や秘密情報ファイルがGit管理対象外になっていること。
- OK：ローカルsecretファイルが追跡されないこと。
- NG：`.env` がGit追跡対象になること。

### API確認

- `api/*.js` を確認する。
- OK：secretは `process.env` から取得していること。
- OK：secretをレスポンスに返していないこと。
- OK：secretをconsole出力していないこと。
- NG：secretがエラー表示やJSONレスポンスに出ること。

### clone・ローカル起動時の影響確認

- ローカル起動した場合の接続先と権限を確認する。
- OK：公開キーで許可されたRLS範囲のみアクセスできること。
- OK：管理者操作は管理者認証/RLSなしでは実行できないこと。
- NG：cloneしただけで本番DBの管理操作ができること。

### RLS確認

- 未ログイン、一般ユーザー、管理者で確認する。
- OK：未ログインは公開データのみ読めること。
- OK：一般ユーザーは自分の許可範囲のみ操作できること。
- OK：管理者のみ管理操作できること。
- NG：一般ユーザーが管理者データを読める・更新できること。

### public_profiles確認

- Supabase Security Advisorの警告を確認する。
- OK：警告の内容を把握し、問題の有無を判断していること。
- OK：必要なら別チケット化されていること。
- NG：警告を未確認のまま放置すること。

### Storage確認

- `news-images` bucketの公開範囲を確認する。
- OK：管理者以外がアップロード・削除できないこと。
- OK：公開画像として許容できる範囲が整理されていること。
- NG：一般ユーザーがStorageにアップロード・削除できること。

### 回帰確認

- 本番で通常ログインできること。
- 管理者ログインできること。
- 管理者画面を開けること。
- お知らせ画面を開けること。
- 通常ゲームを遊べること。
- ランキング保存が壊れていないこと。
