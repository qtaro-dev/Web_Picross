# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- ユーザーはコードを直接編集しない前提
- 実装・修正はすべて AIエージェント が行う
- 既存設計を破壊しない
- 既存テーマ・ライブラリ構成を維持する
- 既存の動作確認済み導線を壊さない
- 問題データの既存JSON構造を不用意に壊さない
- チケット1〜36の実装済み機能を壊さない
- 変更後は対象JSファイルに対して `node --check` を実行する

# チケット37: ローカルuserフォルダへのユーザー別JSON保存対応

## 目的

現在、ユーザー登録やクリア状況が画面上・localStorage上には存在しているように見えるが、ローカルフォルダ上にユーザーデータファイルが見当たらない。

開発中に中身を直接確認しやすくするため、以下のフォルダを作成し、ユーザーごとのJSONファイルを平文で保存できるようにする。

```text
E:\Dev\web_picross_Ver2\user
```

保存先イメージ:

```text
E:\Dev\web_picross_Ver2\user\admin.json
E:\Dev\web_picross_Ver2\user\test.json
E:\Dev\web_picross_Ver2\user\00000.json
```

今後はSupabase等のDB連携へ移行する想定だが、現段階では開発・確認用として、ユーザー別JSONをローカルに平文保存できるようにする。

## 重要な前提

ブラウザ単体、VSCode Live Server、`python -m http.server` では、JavaScriptから `E:\Dev\web_picross_Ver2\user` に直接ファイルを書き込むことはできない。

そのため、ローカルファイルへ保存するには、Node.jsなどのローカルサーバAPIが必要。

このチケットでは以下を実装する。

```text
Node.jsサーバ起動時:
- userフォルダへユーザー別JSONを保存する

Live Server / 静的環境:
- localStorage保存を継続
- ユーザー別JSONをダウンロード出力できるようにする
- 画面上に「ローカルファイル直接保存は無効」と表示する
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
- `E:\Dev\web_picross_Ver2\package.json`
- `E:\Dev\web_picross_Ver2\user\`

必要に応じて:

- `E:\Dev\web_picross_Ver2\.gitignore`

## 実装内容

### 1. `user` フォルダを作成する

プロジェクト直下に `user` フォルダを作成する。

```text
E:\Dev\web_picross_Ver2\user
```

注意:

- フォルダが存在しない場合、Node.jsサーバ起動時または保存時に自動作成する
- GitHubへ個人データを上げないようにするため、必要なら `.gitignore` に `user/*.json` を追加する
- 開発用サンプルだけ置く場合は、個人情報を含めない

### 2. ユーザーごとのJSONファイルを作る

ユーザー登録時、ユーザーごとのJSONファイルを作成する。

ファイル名候補:

```text
user/<username>.json
```

例:

```text
user/admin.json
user/00000.json
user/test.json
```

注意:

- ファイル名に使えない文字を安全に置換する
- 同名衝突を避ける
- usernameとuserIdを分けられる場合は、ファイル名はuserIdでもよい
- ただし開発中に見やすいように、usernameが分かる形式を優先する

### 3. ユーザーJSONの形式を定義する

ユーザー別JSONは、開いたらそのまま読めるインデント付きJSONにする。

最低限保存する項目:

```text
- ユーザー情報
- 各面のクリアフラグ
- クリア時のタイム
```

保存形式例:

```json
{
  "version": 1,
  "user": {
    "id": "user_00000",
    "username": "00000",
    "createdAt": "2026-05-18T00:00:00.000Z",
    "updatedAt": "2026-05-18T00:00:00.000Z",
    "source": "local-server"
  },
  "progress": {
    "beginner": {
      "1": {
        "puzzleId": "beginner_mono_id000001",
        "stageNo": 1,
        "cleared": true,
        "clearTimeMs": 53210,
        "clearTimeText": "00:53",
        "clearedAt": "2026-05-18T00:00:00.000Z"
      }
    },
    "easy": {},
    "normal": {},
    "hard": {},
    "endless": {}
  }
}
```

注意:

- パスワードは原則として保存しない
- どうしても開発用に保存する場合でも、本番移行前提であることをREADMEに明記する
- 将来DB化しやすいように `user` と `progress` を分離する
- JSONは `JSON.stringify(data, null, 2)` で整形する

### 4. ユーザー登録時にJSONファイルを作成する

Node.jsサーバ接続中に新規ユーザー登録した場合、以下を行う。

```text
1. ユーザー重複確認
2. ユーザー情報を登録
3. user/<username>.json を作成
4. 初期progressを空で作成
5. ログイン可能にする
```

期待動作:

```text
ユーザー名: 00000
パスワード: 00000
→ 登録
→ E:\Dev\web_picross_Ver2\user\00000.json が作られる
```

### 5. ログイン時にユーザーJSONを読み込む

Node.jsサーバ接続中にログインした場合、該当ユーザーのJSONファイルを読み込む。

期待動作:

```text
00000でログイン
→ user/00000.json を読み込む
→ クリア状況を画面に反映
```

注意:

- ファイルが存在しない場合は初期データを作る
- 壊れたJSONの場合は安全にエラー表示する
- 画面が停止しないようにする

### 6. クリア時にユーザーJSONへ保存する

パズルをクリアしたら、現在ログイン中ユーザーのJSONファイルへ進行状況を保存する。

保存する項目:

```text
- difficulty
- stageNo
- puzzleId
- cleared: true
- clearTimeMs
- clearTimeText
- clearedAt
```

同じ問題を再クリアした場合の扱い:

```text
- latestTimeMs / latestClearTimeText を更新
- bestTimeMs / bestClearTimeText がある場合は短い方を保持
```

最小実装では、最新タイム保存のみでもよい。  
可能ならベストタイムも保存する。

### 7. ユーザーJSON保存APIを作る

Node.jsサーバ側に、ユーザーJSON読み書き用APIを用意する。

候補API:

```text
POST /api/register
POST /api/login
GET /api/user/:username
POST /api/user/:username/progress
POST /api/user/:username/save
GET /api/users
```

最小必須:

```text
POST /api/register
POST /api/login
GET /api/user-data
POST /api/user-progress
```

注意:

- 既存server.jsがある場合は、それを拡張する
- APIがない環境ではlocalStorageフォールバックを使う
- エラー時は画面に分かりやすく表示する

### 8. Live Server / 静的環境ではダウンロード出力にする

VSCode Live Serverでは、ローカルファイルへ直接保存できないため、以下の挙動にする。

```text
- 登録情報はlocalStorageへ保存
- ユーザー別JSON出力ボタンで `<username>.json` をダウンロード
- 画面には「保存方式: localStorage / ファイル直接保存なし」と表示
```

ボタン候補:

```text
現在ユーザーJSON出力
ユーザーデータを書き出し
```

出力ファイル名:

```text
<username>.json
```

例:

```text
00000.json
admin.json
```

### 9. 保存方式を画面に表示する

ログイン画面、メニュー画面、または開発デバッグパネルに、現在の保存方式を表示する。

Node.jsサーバ接続中:

```text
保存方式: userフォルダJSON
保存先: E:\Dev\web_picross_Ver2\user
```

Live Server / 静的環境:

```text
保存方式: localStorage
ファイル直接保存: 無効
JSON出力で確認できます
```

### 10. `.gitignore` を確認する

ユーザーごとのJSONには個人情報やプレイデータが入るため、GitHubへ誤ってpushしないようにする。

`.gitignore` 候補:

```text
user/*.json
!user/.gitkeep
```

必要なら `user/.gitkeep` を作成する。

注意:

- サンプル用の匿名データを置く場合は `user/sample.json` などにし、個人情報を入れない
- 実ユーザーデータはGit管理しない

### 11. READMEに保存方式を追記する

READMEへ以下を追記する。

```text
## ユーザーデータ保存

Node.jsサーバ起動時:
- user/<username>.json に保存
- ユーザー情報、クリアフラグ、クリアタイムを保存

Live Server / 静的環境:
- localStorageに保存
- userフォルダへ直接保存はできない
- JSON出力で内容確認可能

将来:
- Supabase / PostgreSQL等のDB保存へ移行予定
```

## 受け入れ条件

- `E:\Dev\web_picross_Ver2\user` フォルダが存在する
- 必要なら `user/.gitkeep` がある
- ユーザー登録時にユーザー別JSONを作成できる
- `user/<username>.json` を開くと内容が読める
- JSONがインデント付きで整形されている
- JSONにユーザー情報が含まれる
- JSONに各面のクリアフラグが含まれる
- JSONにクリア時のタイムが含まれる
- ログイン時にユーザーJSONを読み込める
- クリア時にユーザーJSONへ進行状況が保存される
- 同じユーザーで再ログインするとクリア状況が復元される
- 別ユーザーのクリア状況が混ざらない
- Live Server環境ではlocalStorage保存とJSON出力にフォールバックする
- 現在の保存方式が画面で確認できる
- `.gitignore` に実ユーザーJSONが含まれない設定がある
- READMEに保存方式が記載されている
- `node --check server.js` が通る
- `node --check js/state.js` が通る
- `node --check js/actions.js` が通る
- `node --check js/render.js` が通る
- `node --check js/main.js` が通る
- 新規JSファイルを作った場合はそれも `node --check` が通る
- 変更したJSファイルすべてで `node --check` が通る

## 確認手順

### Node.jsサーバ確認

```bat
cd /d E:\Dev\web_picross_Ver2
node server.js
```

確認URLは実装済みserver.jsの設定に従う。

例:

```text
http://127.0.0.1:3000/
```

確認導線:

```text
タイトル
→ ユーザー登録
→ 00000 / 00000 登録
→ user/00000.json が作成されることを確認
→ ログイン
→ パズルをクリア
→ user/00000.json にクリアフラグとタイムが保存されることを確認
```

### Live Server確認

```text
http://127.0.0.1:5500/index.html
```

確認導線:

```text
タイトル
→ ユーザー登録
→ localStorage保存になることを確認
→ 現在ユーザーJSON出力
→ 00000.json がダウンロードされることを確認
```

## 最終報告

```text
- 変更したファイル
- userフォルダ作成内容
- ユーザー別JSONファイル名ルール
- ユーザーJSON保存形式
- クリアフラグ保存形式
- クリアタイム保存形式
- Node.jsサーバ時の保存仕様
- Live Server時のフォールバック仕様
- .gitignore更新内容
- README更新内容
- 確認した動作
- node --check の結果
- Node.jsサーバ確認結果
- Live Server確認結果
- 未確認事項または注意点
```
