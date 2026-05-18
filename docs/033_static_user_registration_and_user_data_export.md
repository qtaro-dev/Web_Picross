# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- ユーザーはコードを直接編集しない前提
- 実装・修正はすべて AIエージェント が行う
- 既存設計を破壊しない
- 既存テーマ・ライブラリ構成を維持する
- 既存の動作確認済み導線を壊さない
- 問題データの既存JSON構造を不用意に壊さない
- チケット1〜31の実装済み機能を壊さない
- 変更後は対象JSファイルに対して `node --check` を実行する

# チケット33: Live Server対応のユーザー登録フォールバックとユーザーデータJSON出力

## 目的

VSCode Live Server などの静的環境でも、ユーザー登録とログインを試せるようにする。

現在、`http://127.0.0.1:5500/index.html` のLive Server環境ではサーバAPIが存在しないため、ユーザー登録時に以下のような表示になる。

```text
サーバ未接続のため登録できません
```

この状態では開発確認がしにくいため、静的環境では `localStorage` を使った簡易ユーザー登録フォールバックを実装する。

また、登録したユーザー情報とプレイ進行データを、内容確認しやすいJSONファイルとして出力できるようにする。

今の段階では、最低限以下を記録する。

```text
- ユーザー情報
- 各面のクリアフラグ
- クリア時のタイム
```

## 重要な前提

静的Webアプリでは、ブラウザからローカルファイルやサーバ上のユーザーファイルへ直接書き込むことはできない。

そのため、Live Server / 静的環境では以下の方式を採用する。

```text
登録・ログイン:
- localStorage に保存

内容確認:
- ユーザーデータJSONをダウンロード出力

将来:
- Node.jsサーバAPI / Supabase / DB連携へ置き換え可能な構造にする
```

## 対象ファイル（推定）

- `E:\Dev\web_picross_Ver2\js\state.js`
- `E:\Dev\web_picross_Ver2\js\actions.js`
- `E:\Dev\web_picross_Ver2\js\render.js`
- `E:\Dev\web_picross_Ver2\js\data.js`
- `E:\Dev\web_picross_Ver2\js\main.js`
- `E:\Dev\web_picross_Ver2\styles.css`
- `E:\Dev\web_picross_Ver2\README.md`

必要に応じて新規作成:

- `E:\Dev\web_picross_Ver2\js\userData.js`

## 実装内容

### 1. Live Server / 静的環境で登録できるようにする

サーバAPIに接続できない場合でも、localStorageへ保存する簡易ユーザー登録を行う。

期待動作:

```text
ユーザー名: test
パスワード: test
→ ユーザー登録
→ localStorageに保存
→ test / test でログイン可能
```

注意:

- 既存の admin/admin 固定ログインは維持する
- サーバAPIがある場合はサーバAPIを優先してよい
- APIが使えない場合のみlocalStorageフォールバックへ切り替える
- 「サーバ未接続のため登録できません」で止めない

### 2. localStorageにユーザー情報を保存する

ユーザー情報をlocalStorageに保存する。

保存キー候補:

```text
picross_v2_users
```

保存形式候補:

```json
{
  "users": [
    {
      "id": "user_admin",
      "username": "admin",
      "password": "admin",
      "createdAt": "2026-05-18T00:00:00.000Z",
      "source": "built-in"
    },
    {
      "id": "user_test",
      "username": "test",
      "password": "test",
      "createdAt": "2026-05-18T00:00:00.000Z",
      "source": "local"
    }
  ]
}
```

注意:

- 今回は開発用なので平文パスワードでもよい
- 本番向けでは平文保存しないことをコメントに残す
- ユーザー名の重複登録は禁止する
- 空ユーザー名、空パスワードは禁止する

### 3. ログイン時にlocalStorageユーザーも参照する

ログイン時は以下の順で認証する。

```text
1. admin/admin 固定ユーザー
2. サーバAPIが使える場合はサーバAPI
3. localStorageに登録されたユーザー
```

実装上は順序を多少変えてもよいが、Live Server環境で登録ユーザーがログインできることを必須にする。

### 4. ユーザーごとのクリア状況を保存する

各ユーザーごとに、各面のクリアフラグとクリアタイムを記録する。

保存キー候補:

```text
picross_v2_user_data
```

保存形式候補:

```json
{
  "version": 1,
  "users": {
    "user_test": {
      "username": "test",
      "progress": {
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
}
```

最低限必要な項目:

```text
- username
- difficulty
- stageNo または puzzleId
- cleared
- clearTimeMs または clearTimeText
- clearedAt
```

注意:

- puzzle id / stageNo のどちらをキーにするか既存設計に合わせる
- 同じ面を再クリアした場合、ベストタイムを保存するか最新タイムを保存するか決める
- 最小実装では最新タイム保存でよい
- 可能なら bestTimeMs も保存する

### 5. クリア時にユーザーデータへ記録する

パズルをクリアしたタイミングで、現在ログイン中ユーザーの進行データへ記録する。

期待動作:

```text
ログイン中ユーザー: test
ビギナー #1 クリア
→ test の beginner #1 に cleared: true と clearTime を保存
```

### 6. パズルセレクトのクリア表示はユーザーデータを参照する

パズルセレクト画面のクリア数やCLEAR表示は、現在ログイン中ユーザーの進行データを参照する。

期待動作:

```text
testでログイン
→ testのクリア状況を表示

adminでログイン
→ adminのクリア状況を表示
```

注意:

- サムネイルの有無でクリア扱いしない
- チケット32の分離仕様を維持する

### 7. ユーザーデータJSONを出力できるようにする

登録ユーザー情報と進行データを、内容確認しやすいJSONファイルとしてダウンロードできるようにする。

ボタン候補:

```text
ユーザーデータJSON出力
ユーザーデータを書き出し
```

配置候補:

```text
- ログイン画面
- メニュー画面
- パズルセレクト右上デバッグパネル
```

出力ファイル名候補:

```text
picross_user_data.json
picross_user_data_YYYYMMDD_HHMMSS.json
```

出力内容候補:

```json
{
  "version": 1,
  "exportedAt": "2026-05-18T00:00:00.000Z",
  "users": [
    {
      "id": "user_test",
      "username": "test",
      "createdAt": "2026-05-18T00:00:00.000Z"
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

- できれば出力JSONにはパスワードを含めない
- 内容確認用に必要な場合でも、開発用であることを明記する
- インデント付きJSONにする

### 8. ユーザーデータJSONを画面で確認できるようにする

「開いたら読める形式にしたい」ため、最低限はインデント付きJSONとしてダウンロードできるようにする。

期待仕様:

```text
JSON.stringify(data, null, 2)
```

可能なら、デバッグパネル内にユーザーデータ確認用の表示欄も追加する。

### 9. ユーザーデータ削除と連携する

チケット31のユーザーデータ削除機能と連携し、localStorageに保存したユーザー進行データを削除できるようにする。

注意:

- ユーザーアカウント自体を削除するのか、進行データだけを削除するのか分ける
- 固定adminは削除しない
- 削除前に確認モーダルを出す

### 10. READMEに静的環境での扱いを書く

READMEに以下を追記する。

```text
- Live Server / 静的環境ではlocalStorageにユーザー情報を保存する
- 本番向け認証ではない
- 将来的にSupabase等のDB連携へ移行予定
- ユーザーデータJSON出力で内容確認できる
```

## 受け入れ条件

- VSCode Live Serverで起動できる
- `http://127.0.0.1:5500/index.html` で確認できる
- admin/adminでログインできる
- 新規ユーザー登録ができる
- 登録したユーザーでログインできる
- サーバ未接続でもユーザー登録ができる
- localStorageにユーザー情報が保存される
- 同じユーザー名は重複登録できない
- 空ユーザー名、空パスワードは登録できない
- クリア時に現在ユーザーのクリアフラグが保存される
- クリア時のタイムが保存される
- パズルセレクトのCLEAR表示が現在ユーザーのデータを参照する
- パズルセレクトのクリア数が現在ユーザーのデータを参照する
- サムネイルの有無でクリア扱いされない
- ユーザーデータJSONを出力できる
- 出力JSONがインデント付きで読める
- 出力JSONにユーザー情報が含まれる
- 出力JSONに各面のクリアフラグが含まれる
- 出力JSONにクリア時のタイムが含まれる
- ユーザーデータ削除で進行データを消せる
- 固定adminユーザーが消えない
- READMEに静的環境でのユーザー保存仕様が追記されている
- `node --check js/state.js` が通る
- `node --check js/actions.js` が通る
- `node --check js/render.js` が通る
- `node --check js/main.js` が通る
- 新規JSファイルを作った場合はそれも `node --check` が通る
- 変更したJSファイルすべてで `node --check` が通る

## 確認手順

VSCode Live Serverで確認する。

```text
http://127.0.0.1:5500/index.html
```

確認導線:

```text
タイトル
→ ログイン / ユーザー登録
→ 新規ユーザー登録
→ 登録ユーザーでログイン
→ メニュー
→ ゲームセレクト
→ 問題をクリア
→ クリア数とCLEAR表示を確認
→ ユーザーデータJSON出力
→ JSONファイルを開いて内容確認
```

## 最終報告

```text
- 変更したファイル
- Live Serverでの登録フォールバック仕様
- localStorage保存キー
- ユーザー情報の保存形式
- クリア状況の保存形式
- クリアタイムの保存形式
- ユーザーデータJSON出力仕様
- README更新内容
- 確認した動作
- node --check の結果
- Live Server確認結果
- 未確認事項または注意点
```
