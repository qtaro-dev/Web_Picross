# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- ユーザーはコードを直接編集しない前提
- 実装・修正はすべて AIエージェント が行う
- 既存設計を破壊しない
- 既存テーマ・ライブラリ構成を維持する
- 既存の動作確認済み導線を壊さない
- 問題データの既存JSON構造を不用意に壊さない
- チケット1〜39の実装済み機能を壊さない
- 変更後は対象JSファイルに対して `node --check` を実行する

# チケット40: ユーザーデータ日時表示を人が読める形式に整形する

## 目的

ユーザーデータ画面のクリア日時が、現在以下のようなISO文字列で表示されている。

```text
2026-05-18T05:23:16.665Z
```

この形式は開発者向けには扱いやすいが、画面上で人が読むには分かりにくい。

ユーザーデータ画面、JSON出力、ユーザー別JSON保存時に、人が読みやすい日時形式も併記する。

## 対象ファイル（推定）

- `E:\Dev\web_picross_Ver2\js\state.js`
- `E:\Dev\web_picross_Ver2\js\actions.js`
- `E:\Dev\web_picross_Ver2\js\render.js`
- `E:\Dev\web_picross_Ver2\js\main.js`
- `E:\Dev\web_picross_Ver2\js\userData.js`
- `E:\Dev\web_picross_Ver2\server.js`
- `E:\Dev\web_picross_Ver2\styles.css`
- `E:\Dev\web_picross_Ver2\README.md`

## 現状の問題

ユーザーデータ画面の「クリア日時」が以下のように表示されている。

```text
2026-05-18T05:23:16.665Z
```

問題点:

```text
- 日本時間かUTCか分かりにくい
- 秒以下が不要
- 画面上でぱっと読みにくい
- 一般ユーザー向けの表示として不自然
```

## 実装内容

### 1. 表示用日時フォーマット関数を追加する

日時文字列を人が読める形式に変換する共通関数を追加する。

候補関数名:

```js
formatDateTimeForDisplay()
formatUserDateTime()
formatLocalDateTime()
```

変換例:

```text
2026-05-18T05:23:16.665Z
→ 2026/05/18 14:23:16
```

注意:

- 日本時間表示にする
- ブラウザのローカルタイムゾーンで表示してよい
- 秒まで表示する
- ミリ秒は表示しない
- 無効な日時や空値は `-` を返す

### 2. ユーザーデータ画面の日時表示を整形する

ユーザーデータ画面の以下の表示を、人が読める形式にする。

対象候補:

```text
- 作成日時
- 最終更新日時
- クリア日時
- 最終プレイ日時
- 失敗日時
- ギブアップ日時
- 履歴日時
```

変更前:

```text
2026-05-18T05:23:16.665Z
```

変更後:

```text
2026/05/18 14:23:16
```

### 3. JSON保存時に表示用日時も併記する

内部処理用のISO日時は残しつつ、人が読める表示用の日時も保存する。

保存例:

```json
{
  "clearedAt": "2026-05-18T05:23:16.665Z",
  "clearedAtText": "2026/05/18 14:23:16"
}
```

対象候補:

```text
- createdAt / createdAtText
- updatedAt / updatedAtText
- clearedAt / clearedAtText
- failedAt / failedAtText
- gaveUpAt / gaveUpAtText
- lastPlayedAt / lastPlayedAtText
```

注意:

- DB移行やソート用にISO形式は残す
- 画面表示用として `xxxText` を追加する
- 既存JSONを壊さない
- 既存データに `xxxText` がない場合は、表示時にISOから生成する

### 4. ユーザー別JSON出力にも表示用日時を含める

`user/<username>.json` やユーザーデータJSON出力にも、表示用日時を含める。

期待形式:

```json
{
  "puzzleId": "beginner_mono_id000001",
  "stageNo": 1,
  "cleared": true,
  "clearTimeMs": 53210,
  "clearTimeText": "00:53",
  "clearedAt": "2026-05-18T05:23:16.665Z",
  "clearedAtText": "2026/05/18 14:23:16"
}
```

### 5. 既存データの表示互換を保つ

すでに保存済みのユーザーデータには `clearedAtText` が存在しない可能性がある。

その場合でも、ユーザーデータ画面では `clearedAt` から表示用日時を生成して表示する。

表示優先順位:

```text
1. clearedAtText があればそれを表示
2. clearedAt があれば formatDateTimeForDisplay(clearedAt) を表示
3. どちらもなければ -
```

### 6. タイム表示と日時表示を混同しない

以下を明確に分ける。

```text
クリアタイム:
- 00:53
- 01:20

クリア日時:
- 2026/05/18 14:23:16
```

注意:

- `clearTimeText` はプレイ時間
- `clearedAtText` は日時
- 名前を混同しない

### 7. READMEに日時保存仕様を追記する

READMEまたはdocsに、日時保存形式について追記する。

記載例:

```text
日時データは、内部処理用のISO形式と、表示確認用のローカル日時文字列を併記する。

例:
clearedAt: 2026-05-18T05:23:16.665Z
clearedAtText: 2026/05/18 14:23:16
```

## 受け入れ条件

- ユーザーデータ画面でISO形式の日時がそのまま表示されない
- クリア日時が `2026/05/18 14:23:16` のような読みやすい形式で表示される
- 作成日時が読みやすい形式で表示される
- 最終更新日時が読みやすい形式で表示される
- 失敗日時がある場合、読みやすい形式で表示される
- ギブアップ日時がある場合、読みやすい形式で表示される
- 既存のISO日時データは削除されない
- JSON保存時に `clearedAt` と `clearedAtText` の両方を持てる
- 既存データに `clearedAtText` がなくても表示時に整形される
- 無効な日時や空値は `-` 表示になる
- クリアタイム `00:53` とクリア日時 `2026/05/18 14:23:16` が混同されない
- ユーザー別JSON出力でも読みやすい日時が確認できる
- READMEに日時保存仕様が追記されている
- `node --check js/state.js` が通る
- `node --check js/actions.js` が通る
- `node --check js/render.js` が通る
- `node --check js/main.js` が通る
- 新規JSファイルを作った場合はそれも `node --check` が通る
- server.jsを変更した場合は `node --check server.js` が通る
- 変更したJSファイルすべてで `node --check` が通る

## 確認手順

### Live Server確認

```text
http://127.0.0.1:5500/index.html
```

確認導線:

```text
タイトル
→ admin/adminでログイン
→ ゲームセレクト
→ 問題をクリア
→ メニュー
→ ユーザーデータ
→ クリア日時が読みやすい形式になっていることを確認
```

### Node.jsサーバ確認

```bat
cd /d E:\Dev\web_picross_Ver2
node server.js
```

確認導線:

```text
adminでログイン
→ 問題をクリア
→ user/admin.json を開く
→ clearedAt と clearedAtText が両方あることを確認
```

## 最終報告

```text
- 変更したファイル
- 日時フォーマット関数の実装場所
- 表示用日時形式
- JSON保存時の日時形式
- 既存データ互換の扱い
- README更新内容
- node --check の結果
- Live Server確認結果
- Node.jsサーバ確認結果
- 未確認事項または注意点
```
