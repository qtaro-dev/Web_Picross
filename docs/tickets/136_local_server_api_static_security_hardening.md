# チケット136：ローカル進捗APIと静的配信の安全性改善

## 目的

コードレビューで、ローカルサーバー用の `/api/user-progress` が `username` だけで進捗保存できること、また `serveStatic()` の配信範囲判定が `filePath.startsWith(rootDir)` に依存していることが指摘された。

本番Vercel運用とは別系統でも、ローカル運用時の事故や悪用を避けるため、ローカルAPIと静的配信の安全性を改善する。

## 対象ファイル（推定）

- `server.js`
- `js/actions.js`
- `js/supabaseAuth.js`
- `js/config.js`
- `README.md`
- `docs/ticket_status.json`

## 実装内容

### 1. /api/user-progress の保存条件を強化する

- `/api/user-progress` の実装を確認する。
- `username` だけで任意ユーザーの進捗JSONを更新できないようにする。
- ローカル保存でも、以下のいずれかを検討する。
  - ログイン済みセッションとの一致確認
  - パスワード確認
  - ローカル専用トークン
  - 管理者限定
- 少なくとも、任意のusernameをPOSTするだけで進捗が上書きされる状態を避ける。

### 2. エラー処理を整理する

- 認証不足、ユーザー不一致、不正リクエスト時に明確なエラーを返す。
- 成功していないのに成功表示しない。
- ローカル用途であることをREADMEに明記する。

### 3. serveStatic() のパス検証を修正する

- `filePath.startsWith(rootDir)` による配信範囲チェックをやめる。
- `path.relative(rootDir, filePath)` を使い、以下を拒否する。
  - `..` で始まるパス
  - 絶対パス化された外部パス
  - rootDir外のファイル
- Windowsで `web_picross_Ver2` と `web_picross_Ver20` のような前方一致誤判定が起きないようにする。

### 4. 既存ローカル開発体験を維持する

- `python -m http.server` とは別に、`server.js` を使う開発手順がある場合は壊さない。
- `/`、JS、CSS、JSON、画像ファイルが従来どおり配信されること。
- 不正パスだけ拒否する。

## 受け入れ条件（目視確認基準）

### user-progress不正更新防止

- 未認証または別ユーザーとして `/api/user-progress` へ任意usernameで保存を試す。
- OK：拒否されること。
- NG：任意ユーザーの進捗が更新できること。

### 正規保存

- 正規のログイン状態または許可されたローカル条件で進捗保存する。
- OK：従来どおり保存できること。
- NG：正規保存まで失敗すること。

### 静的配信

- `/`、`/js/render.js`、`/styles.css`、`/data/news.json` を取得する。
- OK：従来どおり200で配信されること。
- NG：通常ファイルまで拒否されること。

### パストラバーサル防止

- `../` を含むパスやrootDir外を参照するパスを試す。
- OK：403または404で拒否されること。
- NG：rootDir外のファイルが取得できること。
