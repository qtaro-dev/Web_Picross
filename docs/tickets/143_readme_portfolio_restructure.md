# チケット143：READMEをポートフォリオ向け表紙として再構成する

## 目的

現在の `README.md` は、プロジェクト概要、機能一覧、Supabase設定、管理者機能、メール設定、削除申請、パズル管理、Storage、エディタ、デバッグ、ユーザーデータ保存などの詳細情報が1ファイルにまとまっている。

情報量は十分だが、GitHub上で初見の人が読むには長く、ポートフォリオとして「何を作ったのか」「何ができるのか」「どの技術を使ったのか」がすぐに伝わりにくい。

このチケットでは、`README.md` を初見向け・ポートフォリオ向けの表紙として短く再構成する。  
既存の詳細情報は削除せず、`docs/` 配下のドキュメントへ退避・分割し、READMEからリンクする構成にする。

## 対象ファイル（推定）

- `README.md`
- `docs/project_details.md`
- `docs/setup_local.md`
- `docs/admin_guide.md`
- `docs/editor_guide.md`
- `docs/operation_notes.md`
- `docs/supabase/README.md`
- `docs/ticket_status.json`
- 必要に応じて既存 `docs/supabase/*.sql`
- 必要に応じて既存 `docs/*.md`

## 実装方針

### 1. README.md は「見せる用」に短縮する

`README.md` は、GitHubで最初に見る人向けの表紙として再構成する。

READMEに残す主な内容：

- プロジェクト名
- 概要
- 公開URL
- 主な機能
- 技術構成
- 実装・改善ポイント
- ローカル起動方法の最小手順
- ドキュメントリンク
- セキュリティ上の注意
- 現在のビルド番号

READMEから外す主な内容：

- Supabase環境変数の詳細
- Security Advisorの詳細説明
- メール確認、パスワード再設定、メール変更の詳細
- 管理者ページの詳細操作
- 削除申請、利用停止、復活処理の詳細
- パズル管理の詳細手順
- Storage bucketの詳細
- ローカルAPIの詳細
- ユーザーデータ保存の詳細
- デバッグ機能の詳細
- 背景画像一覧などの詳細設定

### 2. 既存READMEの詳細情報は削除せずdocsへ退避する

既存の詳細説明は、原則として削除しない。  
まずは安全性を優先し、詳細情報を `docs/project_details.md` に退避する。

推奨構成：

```text
README.md
→ 初見向け・ポートフォリオ向けの表紙

docs/project_details.md
→ 旧READMEの詳細情報を大きく退避した詳細仕様メモ

docs/setup_local.md
→ ローカル起動、.env、npm start、Supabase接続確認

docs/supabase/README.md
→ Supabase構成、環境変数、RLS、Storage、Security Advisor

docs/admin_guide.md
→ 管理者ページ、パズル管理、お知らせ管理、ユーザー管理

docs/editor_guide.md
→ エディタ、JSON、grid_strings、スロット保存

docs/operation_notes.md
→ Vercel本番確認、SQL適用、運用注意
```

ただし、初回実装で無理に細かく分割しすぎない。  
リンク切れや情報欠落が起きる場合は、まず `docs/project_details.md` への退避を優先し、細分化は後続チケットへ回してよい。

### 3. READMEの推奨構成

READMEは以下の順序を基本にする。

```markdown
# Web Picross

## 概要

## 公開URL

## スクリーンショット

## 主な機能

## 技術構成

## 実装・改善ポイント

## ローカル起動

## ドキュメント

## セキュリティ・公開設定について

## ビルド情報
```

### 4. README概要文の方向性

概要では、以下の内容が短く伝わるようにする。

- ブラウザで遊べるWeb版ピクロス
- HTML / CSS / JavaScriptで構成
- Vercelで公開
- Supabase連携によりユーザー登録、進捗保存、ランキング、管理者機能に対応
- 管理者ページからパズルJSONやお知らせを管理できる
- ポートフォリオ掲載用に既存Webピクロスをリニューアルしたもの

例：

```markdown
ブラウザで遊べるWeb版ピクロスです。  
HTML / CSS / JavaScriptで構成し、Vercel公開、Supabase連携、ユーザー進捗保存、ランキング、管理者ページ、パズルエディタまで拡張しています。
```

### 5. 公開URLを明記する

README上部に公開URLを明記する。

```markdown
## 公開URL

- https://web-picross.vercel.app/
```

必要に応じて、ポートフォリオ用URLや補足URLも記載する。

### 6. スクリーンショット枠を用意する

まだスクリーンショットを入れない場合でも、後から追加しやすい枠を作る。

例：

```markdown
## スクリーンショット

※ 準備中
```

または、既にリポジトリ内に公開してよい画像がある場合のみ使用する。  
機密情報、管理者画面の個人情報、Supabase URL、メールアドレスなどが写った画像は使わない。

### 7. 主な機能は短い箇条書きにする

現在のREADMEには詳細な機能一覧があるが、README上では代表的な機能に絞る。

例：

```markdown
## 主な機能

- モノクロ / カラーピクロス
- 難易度別パズル選択
- ユーザー登録 / ログイン
- 進捗保存 / クリア履歴 / ランキング
- パズルエディタ
- `grid_strings` 文字列入力
- 管理者ページ
- パズルJSONアップロード
- お知らせ管理
- Supabase / Vercel連携
```

### 8. 技術構成は表にする

技術構成は、初見でも見やすいように表にする。

例：

```markdown
## 技術構成

| 区分 | 内容 |
|---|---|
| Frontend | HTML / CSS / JavaScript |
| Hosting | Vercel |
| Backend / DB | Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Local dev | Node.js server / localStorage fallback |
```

### 9. 実装・改善ポイントをポートフォリオ向けに書く

単なる機能羅列ではなく、実装で工夫した点を前面に出す。

例：

```markdown
## 実装・改善ポイント

- 既存Webピクロスをポートフォリオ用にリニューアル
- Supabase Authによるユーザー管理
- RLSを前提にした進捗・ランキング保存
- 管理者専用のパズル管理・お知らせ管理
- エディタでJSON入出力と `grid_strings` 入力に対応
- 大盤面向けのスクロール保持・ミニマップ・差分更新
- 公開キーとsecret keyの分離を明記
```

### 10. ローカル起動方法は最小限にする

READMEには最短手順だけを書く。  
詳細は `docs/setup_local.md` へ移す。

例：

````markdown
## ローカル起動

```bash
npm install
npm start
```

起動後、ブラウザで以下を開きます。

```text
http://127.0.0.1:8000/
```

静的確認のみの場合：

```bash
python -m http.server 8000 --bind 127.0.0.1
```

詳細は [ローカル起動・環境設定](docs/setup_local.md) を参照してください。
````

### 11. ドキュメントリンクを整理する

READMEから詳細ドキュメントへ移動しやすくする。

例：

```markdown
## ドキュメント

- [詳細仕様メモ](docs/project_details.md)
- [ローカル起動・環境設定](docs/setup_local.md)
- [Supabase構成](docs/supabase/README.md)
- [管理者機能](docs/admin_guide.md)
- [エディタ機能](docs/editor_guide.md)
- [運用メモ](docs/operation_notes.md)
- [チケット一覧](docs/tickets/)
```

存在しないファイルへリンクしない。  
作成しないドキュメントはリンクから外す。

### 12. セキュリティ・公開設定の注意を短く残す

READMEには、secretを入れないことだけ短く明記する。  
詳細はSupabaseドキュメントへ移す。

例：

```markdown
## セキュリティ・公開設定について

このリポジトリには、Supabase secret key、DBパスワード、service role key、Vercel/GitHub token は含めません。  
公開してよい値と非公開にする値の扱いは [Supabase構成](docs/supabase/README.md) を参照してください。
```

### 13. ビルド情報を残す

現在のビルド番号は残す。

例：

```markdown
## ビルド情報

現在のビルドは `Build #0000150` です。  
ビルド番号は `js/config.js` の `BUILD_INFO` で管理しています。
```

README再構成だけでBuild番号を上げるかどうかは既存運用に従う。  
既存運用上、チケット修正ごとに+1するなら `Build #0000151` へ更新する。

### 14. 相対リンクを壊さない

docsへ移動した内容内のリンクは、移動後の相対パスに合わせて修正する。

例：

- `docs/supabase/001_schema.sql` へのリンク
- `docs/vercel_supabase_production_checklist.md` へのリンク
- `docs/tickets/*.md` へのリンク
- `js/config.js` へのリンク
- `.env.example` へのリンク

`docs/project_details.md` などに旧README内容を移す場合、README基準だった相対リンクがdocs基準に変わるため、必要に応じて `../` を付ける。

### 15. チケット一覧移動後の構成に合わせる

現在チケット文書は `docs/tickets/` 配下へ整理済み。  
READMEや詳細ドキュメント内でチケット文書を参照する場合は、`docs/tickets/` を前提にする。

### 16. ticket_statusを更新する

`docs/ticket_status.json` にチケット143を追加または更新する。

記載内容の例：

- チケット番号: 143
- タイトル: READMEをポートフォリオ向け表紙として再構成
- status: 修正済
- note: READMEを短縮し、詳細情報をdocs配下へ退避・分割した

## 受け入れ条件（目視確認基準）

### README表示確認

1. GitHubでリポジトリトップを開く。
2. `README.md` の表示を確認する。

OK：

- 最初の数画面でプロジェクト概要、公開URL、主な機能、技術構成が分かる。
- READMEが長すぎず、初見でも読みやすい。
- Supabaseや管理者機能の詳細説明で冒頭が埋まっていない。
- ポートフォリオとして見せたい実装内容が前に出ている。

NG：

- 旧READMEと同じように長すぎる。
- 何のアプリかすぐ分からない。
- 公開URLや技術構成が見つけにくい。
- 詳細情報を削除してしまい、どこにも残っていない。

### 詳細ドキュメント確認

1. READMEの「ドキュメント」リンクを開く。
2. 各リンク先が存在するか確認する。

OK：

- READMEからリンクされたdocsファイルが存在する。
- `docs/project_details.md` などに旧READMEの詳細情報が残っている。
- Supabase、管理者、エディタ、運用メモの情報へたどれる。

NG：

- リンク切れがある。
- 重要な詳細情報が削除されている。
- 移動先の相対リンクが壊れている。

### GitHubリンク確認

1. README内の相対リンクをクリックする。

OK：

- `docs/`、`docs/supabase/`、`docs/tickets/`、`.env.example`、`js/config.js` などへ正しく移動できる。
- 存在しないパスへ飛ばない。

NG：

- 404になるリンクがある。
- docsへ移動したことでリンク階層が壊れている。

### ローカル表示確認

1. ローカルで `README.md` をVSCodeまたはGitHub上のプレビューで確認する。
2. Markdownの見出し、表、コードブロックが崩れていないか確認する。

OK：

- 見出し階層が自然。
- 表が崩れていない。
- コードブロックが閉じ忘れていない。
- 日本語の説明が途中で切れていない。

NG：

- コードブロックの閉じ忘れがある。
- 表が壊れている。
- 見出し階層が不自然。

### アプリ影響確認

READMEとdocs整理が主目的のため、アプリ本体への影響は出さない。

OK：

- `index.html`
- `styles.css`
- `js/*.js`
- `data/*.json`
- `api/*.js`

に不要な差分がない。

NG：

- README整理だけのはずなのに、アプリ本体コードやパズルデータが変更されている。

### ビルド番号確認

1. `js/config.js` の `BUILD_INFO` を確認する。
2. READMEのビルド情報と一致しているか確認する。

OK：

- 既存運用に従い、必要ならBuild番号が更新されている。
- READMEのビルド情報と `js/config.js` が一致している。

NG：

- READMEと `js/config.js` のビルド番号が違う。
- チケット143を反映したのに `docs/ticket_status.json` が更新されていない。

### 回帰確認

README/docs整理のみの場合、最低限以下を確認する。

- GitHubトップでREADMEが表示される
- README内リンクが開ける
- `docs/tickets/` が開ける
- `docs/ticket_status.json` がJSONとして壊れていない

OK：

- ドキュメント整理として成立している。
- アプリ本体に不要な影響がない。

NG：

- READMEが表示崩れする。
- リンク切れが多い。
- JSON parseが壊れる。
- アプリ本体に無関係な差分が混ざる。
