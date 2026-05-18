# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- ユーザーはコードを直接編集しない前提
- 実装・修正はすべて AIエージェント が行う
- 既存設計を破壊しない
- 既存テーマ・ライブラリ構成を維持する
- 既存の動作確認済み導線を壊さない
- 問題データの既存JSON構造を不用意に壊さない
- チケット1〜33の実装済み機能を壊さない
- 変更後は対象JSファイルに対して `node --check` を実行する

# チケット35: ユーザー登録データのusers.json保存確認とローカルファイル出力対応

## 目的

ユーザーを追加しても `users.json` に格納されておらず、ローカルにユーザーデータファイルが作られていない問題を修正する。

現在、VSCode Live Serverなどの静的環境では、ブラウザからローカルファイルへ直接書き込みできないため、`users.json` が自動更新されない。  
この制約を踏まえて、以下のどちらか、または両方を実装する。

```text
A. Node.js簡易サーバ起動時は users.json に保存する
B. Live Server / 静的環境では users.json 相当のJSONファイルをダウンロード出力する
```

最小目標は、登録ユーザーとクリア状況を「開いて確認できるJSONファイル」として出力できること。

## 対象ファイル（推定）

フロント側:

- `E:\Dev\web_picross_Ver2\js\state.js`
- `E:\Dev\web_picross_Ver2\js\actions.js`
- `E:\Dev\web_picross_Ver2\js\render.js`
- `E:\Dev\web_picross_Ver2\js\main.js`
- `E:\Dev\web_picross_Ver2\js\userData.js`
- `E:\Dev\web_picross_Ver2\styles.css`
- `E:\Dev\web_picross_Ver2\README.md`

サーバ側がある場合:

- `E:\Dev\web_picross_Ver2\server.js`
- `E:\Dev\web_picross_Ver2\users.json`
- `E:\Dev\web_picross_Ver2\package.json`

## 現状の問題

以下の状態になっている。

```text
- ユーザー登録は画面上でできる
- しかし users.json に登録内容が入らない
- ローカルにユーザーデータファイルが新規作成されない
- 登録内容をファイルとして確認できない
```

原因として考えられること:

```text
- Live Serverは静的サーバなのでファイル書き込みAPIがない
- server.jsを起動していない
- フロント側がlocalStorageに保存しているだけ
- users.jsonへのPOST APIが未実装または未接続
```

## 実装内容

### 1. 現在の保存先を明確にする

ユーザー登録時に、どこへ保存しているか確認する。

確認候補:

```text
- localStorage
- sessionStorage
- users.json
- server.js経由
- 何も保存されていない
```

最終報告で、現在の保存先を明記する。

### 2. Node.jsサーバがある場合はusers.json保存を実装する

`server.js` が存在する場合、ユーザー登録APIで `users.json` に保存できるようにする。

候補API:

```text
POST /api/register
POST /api/login
GET /api/users
GET /api/user-data
POST /api/user-progress
```

最小必須:

```text
POST /api/register
POST /api/login
GET /api/user-data
```

`users.json` 保存形式候補:

```json
{
  "version": 1,
  "updatedAt": "2026-05-18T00:00:00.000Z",
  "users": [
    {
      "id": "user_admin",
      "username": "admin",
      "password": "admin",
      "createdAt": "2026-05-18T00:00:00.000Z",
      "source": "built-in"
    }
  ],
  "progress": {
    "user_admin": {}
  }
}
```

注意:

- まずは開発用なので平文パスワードでもよい
- 本番用では危険であることをREADMEに書く
- 既存のadmin/adminは残す
- JSONを壊さないように読み書きする
- ファイルが存在しない場合は初期生成する

### 3. Live Server環境ではJSONダウンロード出力を行う

Live Serverではローカルファイルへ直接書き込めないため、ユーザーデータをJSONファイルとしてダウンロードできるようにする。

ボタン名候補:

```text
ユーザーデータJSON出力
users.json出力
ユーザーデータを書き出し
```

出力ファイル名候補:

```text
users.json
picross_user_data.json
picross_user_data_YYYYMMDD_HHMMSS.json
```

期待動作:

```text
ユーザー登録
→ localStorageに保存
→ ユーザーデータJSON出力
→ users.json 相当のファイルがダウンロードされる
→ ファイルを開くと内容確認できる
```

### 4. 出力JSONには最低限のユーザー情報と進行データを含める

今の段階で最低限必要な項目:

```text
- ユーザー情報
- 各面のクリアフラグ
- クリア時のタイム
```

出力例:

```json
{
  "version": 1,
  "exportedAt": "2026-05-18T00:00:00.000Z",
  "storage": "localStorage",
  "users": [
    {
      "id": "user_test",
      "username": "test",
      "createdAt": "2026-05-18T00:00:00.000Z",
      "source": "local"
    }
  ],
  "progress": {
    "user_test": {
      "beginner": {
        "1": {
          "cleared": true,
          "clearTimeMs": 53210,
          "clearTimeText": "00:53",
          "clearedAt": "2026-05-18T00:00:00.000Z"
        }
      }
    }
  }
}
```

注意:

- パスワードはできれば出力しない
- 開発確認用でパスワードも必要な場合は、明示的に `debug` セクションへ分ける
- JSONは `JSON.stringify(data, null, 2)` で読みやすく出力する

### 5. ユーザーデータファイルを読み戻せるようにする

可能であれば、出力したユーザーデータJSONを再読み込みできるようにする。

候補:

```text
ユーザーデータJSON読込
```

期待動作:

```text
users.json を選択
→ ユーザーデータ読込
→ localStorageまたはstateに反映
→ 登録ユーザーでログイン可能
→ クリア状況も復元
```

最小実装では出力のみでもよいが、読み戻し未実装の場合は報告する。

### 6. READMEに起動方式ごとの差を書く

READMEに以下を追記する。

```text
python http.server / VSCode Live Server:
- 静的配信のみ
- users.jsonへ直接保存できない
- localStorage保存 + JSON出力で確認

Node.js server.js:
- API経由でusers.jsonへ保存できる
```

### 7. UIで現在の保存方式を表示する

ログイン画面またはデバッグパネルに、現在の保存方式を表示する。

表示例:

```text
保存方式: localStorage
users.json直接保存: 無効
```

Node.jsサーバ接続時:

```text
保存方式: server users.json
users.json直接保存: 有効
```

## 受け入れ条件

- ユーザー登録できる
- 登録したユーザーでログインできる
- 現在の保存方式が画面上で分かる
- Live Server環境ではlocalStorageに保存される
- Live Server環境でユーザーデータJSONを出力できる
- 出力JSONを開くと内容が読める
- 出力JSONにユーザー情報が含まれる
- 出力JSONに各面のクリアフラグが含まれる
- 出力JSONにクリア時のタイムが含まれる
- server.js起動時に対応する場合、users.jsonへ保存される
- users.jsonが存在しない場合、初期生成できる
- admin/admin固定ユーザーは維持される
- READMEに保存方式の違いが書かれている
- `node --check js/state.js` が通る
- `node --check js/actions.js` が通る
- `node --check js/render.js` が通る
- `node --check js/main.js` が通る
- `server.js` を変更した場合は `node --check server.js` が通る
- 変更したJSファイルすべてで `node --check` が通る

## 確認手順

Live Server:

```text
http://127.0.0.1:5500/index.html
```

Node.jsサーバがある場合:

```bat
cd /d E:\Dev\web_picross_Ver2
node server.js
```

確認導線:

```text
タイトル
→ ログイン / ユーザー登録
→ 新規ユーザー登録
→ 登録ユーザーでログイン
→ 問題をクリア
→ ユーザーデータJSON出力
→ JSONファイルを開いて確認
```

## 最終報告

```text
- 変更したファイル
- 現在の保存方式
- localStorage保存仕様
- users.json保存仕様
- JSON出力仕様
- JSON読込対応の有無
- README更新内容
- 確認した動作
- node --check の結果
- Live Server確認結果
- server.js確認結果
- 未確認事項または注意点
```
