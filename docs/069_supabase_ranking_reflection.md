# チケット69: Supabaseランキング反映・表示確認

## 目的

チケット65・66で実装したSupabase保存処理を、ランキング画面に正しく反映する。

## 背景

チケット65で以下の保存処理を実装済み。

```text
user_progress
play_history
ranking_records
```

チケット66で `data/*.json` からSupabase `puzzles` テーブルへのインポート処理を実装済み。

実インポートも成功し、Supabase `puzzles` に38件のパズルデータが登録された。

次は、実際にゲームをクリアした結果が `ranking_records` に保存され、ランキング画面に表示されることを確認・修正する。

## 対象ファイル（推定）

```text
js/supabaseProgress.js
js/data.js
js/render.js
js/actions.js
js/state.js
js/config.js
docs/supabase/001_schema.sql
README.md
```

## 実装内容

- ログイン状態でゲームをクリアした時、`ranking_records` に記録されることを確認する
- ランキング画面がSupabaseの `ranking_records` を取得して表示することを確認する
- 必要に応じてランキング取得処理を修正する
- 表示対象を整理する
  - 難易度
  - ステージ番号
  - ユーザー名
  - ベストタイム
  - クリア日時
- `profiles.username` または `profiles.display_name` をランキング表示名として使う
- パズル名非表示方針がある場合は維持する
- Supabase未設定時は既存のローカルランキングにフォールバックする
- Supabase取得失敗時に画面が壊れないようにする
- F1デバッグクリアの扱いを確認する
  - 現状は通常クリア扱いでランキング対象
  - 今回変更しない場合は、その仕様をREADMEまたはコメントに明記する
- ビルド番号を +1 する

## 確認手順

```text
1. Supabaseログインする
2. ゲームを1問クリアする
3. Supabase Table Editorで ranking_records を確認する
4. アプリのランキング画面を開く
5. クリア記録が表示されるか確認する
6. 別ユーザーでも記録が並ぶか確認する
```

## 受け入れ条件

- クリア後に `ranking_records` へ記録が作成される
- ランキング画面にSupabaseの記録が表示される
- ユーザー名が表示される
- ベストタイムが表示される
- クリア日時が表示される
- 別ユーザーの記録もランキングに反映される
- Supabase未設定時に既存ローカルランキングへフォールバックする
- Supabase取得失敗時に画面が壊れない
- パズル名非表示方針が維持される
- `node --check` が通る

## 最終報告

- 変更したファイル
- ranking_records保存確認結果
- ランキング取得処理
- ランキング表示仕様
- F1デバッグクリアの扱い
- fallback動作
