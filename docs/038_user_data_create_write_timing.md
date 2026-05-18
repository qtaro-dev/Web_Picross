# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- ユーザーはコードを直接編集しない前提
- 実装・修正はすべて AIエージェント が行う
- 既存設計を破壊しない
- 既存テーマ・ライブラリ構成を維持する
- 既存の動作確認済み導線を壊さない
- 問題データの既存JSON構造を不用意に壊さない
- チケット1〜37の実装済み機能を壊さない
- 変更後は対象JSファイルに対して `node --check` を実行する

# チケット38: ログインユーザーのユーザーデータ生成・書き込みタイミング明確化

## 目的

adminユーザーでログインしても、ユーザーデータJSONがいつ作られるのか、いつ書き込まれるのかが分かりづらい。

ログインしているユーザーが存在する場合は、ユーザーデータの作成・読込・書込タイミングを明確にし、ゲーム結果が確実にユーザーデータへ保存されるようにする。

保存・参照タイミングは以下を必須とする。

```text
- ログイン成功時
- ゲームクリア時
- ゲーム失敗時
- ギブアップ時
- ランキング参照時
```

## 対象ファイル（推定）

フロント側:

- `E:\Dev\web_picross_Ver2\js\state.js`
- `E:\Dev\web_picross_Ver2\js\actions.js`
- `E:\Dev\web_picross_Ver2\js\render.js`
- `E:\Dev\web_picross_Ver2\js\main.js`
- `E:\Dev\web_picross_Ver2\js\data.js`
- `E:\Dev\web_picross_Ver2\js\userData.js`
- `E:\Dev\web_picross_Ver2\styles.css`
- `E:\Dev\web_picross_Ver2\README.md`

サーバ側:

- `E:\Dev\web_picross_Ver2\server.js`
- `E:\Dev\web_picross_Ver2\user\`
- `E:\Dev\web_picross_Ver2\users.json`

## 現状の問題

現在、ログイン後に以下が分かりづらい。

```text
- user/admin.json がいつ作られるのか分からない
- admin固定ユーザーのデータファイルが作られない可能性がある
- クリアしてもユーザーデータが変化していないように見える
- 失敗時やギブアップ時の記録タイミングが分からない
- ランキングが何を参照しているか分からない
```

## 実装内容

### 1. ログイン成功時にユーザーデータを必ず作成または読込する

ログイン成功時に、現在ユーザーのユーザーデータを必ず準備する。

期待動作:

```text
adminでログイン
→ user/admin.json が存在するか確認
→ なければ初期データで作成
→ あれば読み込む
→ メニュー画面へ遷移
```

Live Server / 静的環境の場合:

```text
adminでログイン
→ localStorage上にadmin用データが存在するか確認
→ なければ初期データを作成
→ あれば読み込む
```

注意:

- 固定ユーザーadminでも例外扱いせず、ユーザーデータを作る
- ユーザー登録したユーザーも同じ流れにする
- ユーザーデータが壊れている場合は安全にエラー表示する

### 2. ユーザーデータ初期形式を統一する

ユーザー別データはDB移行を見据えて、以下の形式に寄せる。

```json
{
  "version": 1,
  "user": {
    "id": "user_admin",
    "username": "admin",
    "createdAt": "2026-05-18T00:00:00.000Z",
    "updatedAt": "2026-05-18T00:00:00.000Z",
    "source": "local-server"
  },
  "stats": {
    "totalPlayCount": 0,
    "totalClearCount": 0,
    "totalFailCount": 0,
    "totalGiveupCount": 0,
    "totalPlayTimeMs": 0
  },
  "progress": {
    "beginner": {},
    "easy": {},
    "normal": {},
    "hard": {},
    "endless": {}
  },
  "history": []
}
```

注意:

- `stats` は全体集計
- `progress` は各面の現在状態・ベスト記録
- `history` はプレイ履歴
- 将来DBへ移しやすい形にする

### 3. ゲーム開始時にプレイ開始情報を保持する

ゲーム開始時に、現在プレイ中の情報をstateへ保持する。

必要項目:

```text
- currentUserId
- username
- difficulty
- puzzleId
- stageNo
- startedAt
- startedTimeMs
```

この情報をクリア時・失敗時・ギブアップ時の保存に使う。

### 4. ゲームクリア時にユーザーデータへ書き込む

ゲームクリア時に、現在ログイン中ユーザーのデータへクリア記録を書き込む。

保存項目:

```text
- difficulty
- puzzleId
- stageNo
- cleared: true
- clearCount
- latestClearTimeMs
- latestClearTimeText
- bestClearTimeMs
- bestClearTimeText
- clearedAt
- lastPlayedAt
```

履歴にも追加する。

履歴例:

```json
{
  "type": "clear",
  "difficulty": "beginner",
  "puzzleId": "beginner_mono_id000001",
  "stageNo": 1,
  "playTimeMs": 53210,
  "createdAt": "2026-05-18T00:00:00.000Z"
}
```

注意:

- クリア後ロックで多重保存されないようにする
- ヒントやモーダル停止時間はプレイ時間から除外する
- 同じ問題を再クリアした場合はクリア回数を加算する
- ベストタイムは短い方を保持する

### 5. ゲーム失敗時にユーザーデータへ書き込む

時間切れや失敗扱いになった場合、ユーザーデータへ失敗記録を書き込む。

保存項目:

```text
- failed: true
- failCount
- latestFailTimeMs
- failedAt
- lastPlayedAt
```

履歴にも追加する。

履歴例:

```json
{
  "type": "fail",
  "difficulty": "normal",
  "puzzleId": "normal_color_id000003",
  "stageNo": 3,
  "playTimeMs": 1800000,
  "createdAt": "2026-05-18T00:00:00.000Z"
}
```

### 6. ギブアップ時にユーザーデータへ書き込む

ギブアップした場合、ギブアップ回数を記録する。

保存項目:

```text
- giveupCount
- latestGiveupTimeMs
- gaveUpAt
- lastPlayedAt
```

履歴にも追加する。

履歴例:

```json
{
  "type": "giveup",
  "difficulty": "hard",
  "puzzleId": "hard_color_id000010",
  "stageNo": 10,
  "playTimeMs": 421000,
  "createdAt": "2026-05-18T00:00:00.000Z"
}
```

注意:

- ギブアップ回数はユーザー全体statsにも加算する
- 問題別progressにも加算する
- ギブアップ後にクリア扱いしない

### 7. ランキング参照時にユーザーデータを参照する

ランキング画面またはランキング処理では、ユーザーデータのクリア記録・ベストタイムを参照する。

現段階では外部DBや全ユーザーランキングでなくてもよい。

最小仕様:

```text
- 現在ユーザーのクリア済み問題一覧
- 難易度別ベストタイム
- クリア回数
```

将来仕様:

```text
- userフォルダ内の全ユーザーJSONを読んでランキング生成
- Supabase / DBからランキング取得
```

### 8. 保存成功・失敗を開発用表示に出す

ユーザーデータの保存結果を、開発用デバッグ表示またはメニュー画面に表示する。

表示候補:

```text
保存方式: userフォルダJSON
現在ユーザー: admin
ユーザーファイル: user/admin.json
最終読込: 13:42:10
最終保存: 13:48:22
最終保存結果: 成功
```

Live Server時:

```text
保存方式: localStorage
ユーザーファイル直接保存: 無効
最終保存結果: localStorageへ保存
```

### 9. 保存タイミングをREADMEへ記載する

READMEに、ユーザーデータがいつ作られ、いつ更新されるかを追記する。

記載内容:

```text
- ログイン成功時にユーザーデータを作成/読込
- クリア時にクリア記録を保存
- 時間切れ/失敗時に失敗記録を保存
- ギブアップ時にギブアップ回数を保存
- ランキング参照時にユーザーデータを参照
```

## 受け入れ条件

- adminでログインできる
- adminログイン成功時にadmin用ユーザーデータが作成または読込される
- 新規ユーザーでもログイン成功時にユーザーデータが作成または読込される
- ユーザーデータの保存方式が画面上で分かる
- ゲームクリア時に現在ユーザーのデータへクリア記録が保存される
- クリアタイムが保存される
- ベストタイムが保存される、または最新タイムが保存される
- ゲーム失敗時に失敗回数が保存される
- ギブアップ時にギブアップ回数が保存される
- ランキング参照時にユーザーデータを参照できる
- クリア後ロックにより同じクリアが多重保存されない
- Live Server時はlocalStorage保存にフォールバックする
- Node.jsサーバ時はuserフォルダJSONに保存される
- READMEに保存タイミングが記載されている
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
→ メニュー画面
→ 保存方式表示を確認
→ ゲームセレクト
→ 問題をクリア
→ ユーザーデータJSON出力
→ クリア記録とタイムを確認
→ ギブアップ
→ ギブアップ回数を確認
```

### Node.jsサーバ確認

```bat
cd /d E:\Dev\web_picross_Ver2
node server.js
```

確認導線:

```text
タイトル
→ admin/adminでログイン
→ user/admin.json が作成されることを確認
→ 問題をクリア
→ user/admin.json にクリア記録が書き込まれることを確認
```

## 最終報告

```text
- 変更したファイル
- ログイン時のユーザーデータ作成/読込仕様
- クリア時の書き込み仕様
- 失敗時の書き込み仕様
- ギブアップ時の書き込み仕様
- ランキング参照仕様
- ユーザーデータJSON形式
- 保存方式表示の実装内容
- README更新内容
- node --check の結果
- Live Server確認結果
- Node.jsサーバ確認結果
- 未確認事項または注意点
```
