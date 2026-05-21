# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- 実装・修正はすべて AIエージェント が行う
- 既存設計・既存テーマ・ライブラリ構成を破壊しない
- チケット1〜59の実装済み機能を壊さない
- ローカル確認URLは `http://127.0.0.1:8000/` を標準とする
- Vercelにはアプリ本体、UI、docs、チケット、公開してよい設定のみ置く
- Supabase Databaseにはパズルデータ、ユーザーデータ、クリア記録、ランキングを置く
- Supabase StorageにはBGM、SE、背景画像、タイトル画像、サムネイル画像などの素材ファイルを置く
- `user/*.json`、`users.json`、秘密鍵、service role key、DBパスワードはGitHub/Vercelへアップロードしない
- フロントエンドで使うのは公開可能なAnon Keyのみとする
- 変更後は対象JSファイルに対して `node --check` を実行する
- ビルドナンバー運用が実装済みの場合、今回の修正分としてビルド番号を +1 する

# チケット62: Supabase Storageバケット設計と素材配置ルール作成

## 目的

BGM、SE、背景画像、タイトル画像、サムネイル画像をSupabase Storageで管理するため、バケット構成と命名ルールを決める。

## 推奨バケット

```text
web-picross-assets
```

## フォルダ構成

```text
web-picross-assets/
├─ bgm/
├─ se/
├─ backgrounds/
├─ title/
└─ thumbnails/
```

## 実装内容

- `docs/supabase/003_storage_design.md` を作成する
- バケット名を書く
- フォルダ構成を書く
- ファイル命名ルールを書く
- 公開/非公開方針を書く
- 画像圧縮方針を書く
- 音声ビットレート方針を書く

## 命名例

```text
bgm/menu_bgm.mp3
bgm/game_bgm.mp3
se/cell_fill.wav
se/cell_cross.wav
backgrounds/menu_bg_01.jpg
backgrounds/game_bg_01.jpg
title/title_logo.png
thumbnails/beginner_001.jpg
```

## 受け入れ条件

- Storage設計docsがある
- BGM/SE/背景/タイトル/サムネイルの配置先が決まっている
- ファイルサイズ目安が書かれている
- 既存ローカル動作が壊れない

## 最終報告

- 作成したファイル
- バケット名
- フォルダ構成
- 命名ルール
