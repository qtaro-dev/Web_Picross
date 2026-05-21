# Vercel / Supabase 公開構成計画

## 目的

Web Picross Ver2 をローカルJSON中心の構成から、Vercel と Supabase を使った公開構成へ段階的に移行する。
この資料では、現在のファイル配置、公開先、移行先、移行順序を整理する。

## 現在の棚卸し

| 対象 | 現在の役割 | 公開構成での扱い |
| --- | --- | --- |
| `index.html` | アプリのHTMLエントリ | Vercelへ配置 |
| `styles.css` | 画面テーマ、レイアウト | Vercelへ配置 |
| `js/` | 画面描画、状態管理、操作、エディタ | Vercelへ配置 |
| `data/*.json` | 通常問題データ | 当面はVercel配信、段階的にSupabase Databaseの`puzzles`へ移行 |
| `image/*.jpg`, `image/title.png` | 背景、タイトル画像 | 段階的にSupabase Storageへ移行 |
| `image/thumbs/` | 問題サムネイル、プレースホルダー | 段階的にSupabase Storageへ移行 |
| `bgm_se/` | BGM/SE素材置き場 | Supabase Storageへ移行 |
| `server.js` | ローカル開発用API、ユーザーJSON保存 | 本番では使わず、Supabase APIへ置き換え |
| `package.json` | ローカルNodeサーバー依存と起動コマンド | Vercelへ配置してもよいが、本番永続化には使わない |
| `users.json` | ローカル開発用ユーザー一覧 | GitHub/Vercelへ配置しない |
| `user/*.json` | ローカル開発用ユーザー別進行データ | GitHub/Vercelへ配置しない |

## Vercelに置くもの

- `index.html`
- `styles.css`
- `js/`
- `data/` の既存JSONファイル。ただし初期移行中の互換用とし、最終的にはSupabase Database参照へ寄せる
- `image/` の既存素材。ただし初期移行中の互換用とし、最終的にはSupabase Storage参照へ寄せる
- `docs/`
- `package.json`, `package-lock.json`
- 公開してよいSupabase接続設定。フロントエンドで使うのはAnon Keyのみ

## Vercelに置かないもの

- `users.json`
- `user/*.json`
- `.env`
- service role key
- DBパスワード
- Supabase管理用の秘密鍵
- 個人ユーザーの実データ

これらは `.gitignore` で除外し、ブラウザ配信対象にも含めない。

## Supabase Databaseへ移すもの

| 移行元 | 移行先 | 内容 |
| --- | --- | --- |
| `users.json` | `profiles` | ユーザー名、表示名、権限 |
| `data/*.json` | `puzzles` | 難易度、面番号、盤面サイズ、カラー種別、正解データ |
| `user/*.json` の進捗 | `user_progress` | クリア済み、ベストタイム、失敗回数、ヒント使用数 |
| `user/*.json` の履歴 | `play_history` | クリア、失敗、ギブアップなどのプレイ履歴 |
| ランキング集計 | `ranking_records` | 難易度、面番号、ユーザー別クリアタイム |

SQL定義は `docs/supabase/001_schema.sql` と `docs/supabase/002_rls.sql` に分ける。

## Supabase Storageへ移すもの

| 移行元 | 移行先フォルダ | 内容 |
| --- | --- | --- |
| `bgm_se/*.mp3` | `bgm/` | BGM |
| 将来追加するSE | `se/` | セル操作、クリアなどの効果音 |
| `image/back*.jpg` | `backgrounds/` | 背景画像 |
| `image/title.png` | `title/` | タイトルロゴ |
| `image/thumbs/` | `thumbnails/` | 問題サムネイル |

Storage設計は `docs/supabase/003_storage_design.md` にまとめる。

## 移行順序

1. Vercel / Supabase の役割分担をdocsへ固定する。
2. Supabase DatabaseのschemaとRLSを作成する。
3. Supabase Storageのバケット、フォルダ、命名ルールを決める。
4. Supabase接続設定をフロントエンドへ追加する。公開可能なAnon Keyのみを使う。
5. Supabase Authと`profiles`を連携し、`admin/admin`固定ログインを本番導線から外す。
6. `user_progress`, `play_history`, `ranking_records`へ進捗とランキング保存を移す。
7. `data/*.json` を `puzzles` へ移行し、既存JSON読み込みはフォールバック扱いにする。
8. `image/`, `bgm_se/` の素材をStorageへ移行し、URL参照へ切り替える。
9. Vercelへデプロイし、ローカルJSON保存APIに依存しない公開モードを確認する。

## ローカル互換方針

- `python -m http.server 8000 --bind 127.0.0.1` による静的確認は維持する。
- `node server.js` によるローカルユーザーJSON保存は、Supabase移行完了まで開発用として残す。
- 本番公開では `server.js` の `users.json` / `user/*.json` 保存に依存しない。
- 既存のタイトル、メニュー、ゲームセレクト、ゲーム画面、エディタ導線は移行中も壊さない。

## セキュリティ方針

- `admin/admin` はローカル開発用の仮ユーザーとしてのみ扱う。
- 本番ではSupabase Authを使い、固定パスワードを公開導線に残さない。
- ブラウザへ埋め込むのはSupabase Anon Keyのみとする。
- service role key、DBパスワード、JWT secretはGitHub、Vercel、クライアントJSへ置かない。
