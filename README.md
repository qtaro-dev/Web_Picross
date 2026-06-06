# Web Picross

ブラウザで遊べるWeb版ピクロスです。  
HTML / CSS / JavaScriptで構成し、Vercel公開、Supabase連携、ユーザー進捗保存、ランキング、管理者ページ、パズルエディタまで拡張しています。

既存のWebピクロスをポートフォリオ掲載用にリニューアルし、静的Webアプリとして公開できる構成に整理しました。

## 概要

- ブラウザ上で遊べるピクロスゲーム
- モノクロ / カラーパズル対応
- 難易度別の問題選択とプレイ記録保存
- Supabase Auth / Database / Storage 連携
- 管理者ページからパズルJSONとお知らせを管理
- エディタでパズル作成、JSON入出力、`grid_strings` 入力に対応

## 公開URL

- https://web-picross.vercel.app/

## スクリーンショット

※ 準備中

## 主な機能

- モノクロ / カラーピクロス
- 難易度別パズル選択
- 左クリック塗り、右クリック×、ドラッグ連続入力
- ヒント、判定、ギブアップ、難易度別タイマー
- ユーザー登録 / ログイン
- 進捗保存 / クリア履歴 / ランキング
- パズルエディタと `grid_strings` 文字列入力
- 管理者ページ
- パズルJSONアップロード
- お知らせ管理と画像アップロード
- Supabase / Vercel連携

## 技術構成

| 区分 | 内容 |
|---|---|
| Frontend | HTML / CSS / JavaScript |
| Hosting | Vercel |
| Backend / DB | Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Local dev | Node.js server / localStorage fallback |
| Data | JSON puzzle data / Supabase `puzzles` |

## 実装・改善ポイント

- 既存Webピクロスをポートフォリオ向けに再構成
- Supabase Authによるユーザー管理とメール確認導線
- RLSを前提にした進捗、履歴、ランキング保存
- 管理者専用のユーザー管理、パズル管理、お知らせ管理
- エディタでJSON入出力、スロット管理、完成プレビュー、`grid_strings` 入力に対応
- 大盤面向けにスクロール保持、ミニマップ、部分更新を実装
- ランキングやお知らせ表示で公開情報と管理情報を分離
- 公開キーとsecret keyの扱いを分離し、GitHub公開前提の安全性を整理

## ローカル起動

```bash
npm install
npm start
```

起動後、ブラウザで以下を開きます。

```text
http://127.0.0.1:8000/
```

静的確認のみの場合は、次のコマンドでも起動できます。

```bash
python -m http.server 8000 --bind 127.0.0.1
```

詳細は [ローカル起動・環境設定](docs/setup_local.md) を参照してください。

## ドキュメント

- [詳細仕様メモ](docs/project_details.md)
- [ローカル起動・環境設定](docs/setup_local.md)
- [Supabase構成](docs/supabase/README.md)
- [管理者機能](docs/admin_guide.md)
- [エディタ機能](docs/editor_guide.md)
- [運用メモ](docs/operation_notes.md)
- [チケット一覧](docs/tickets/)

## セキュリティ・公開設定について

このリポジトリには、Supabase secret key、DBパスワード、service role key、Vercel/GitHub token は含めません。  
公開してよい値と非公開にする値の扱いは [Supabase構成](docs/supabase/README.md) を参照してください。

`users.json`、`user/*.json`、`.env`、`.env.*` はGit管理しません。公開キーで読める範囲は、RLSで許可した公開パズル、公開お知らせ、ランキング表示用プロフィール最小列に限定する方針です。

## ビルド情報

現在のビルドは `Build #0000151` です。  
ビルド番号は [js/config.js](js/config.js) の `BUILD_INFO` で管理しています。
