# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- ユーザーはコードを直接編集しない前提
- 実装・修正はすべて AIエージェント が行う
- 既存設計を破壊しない
- 既存テーマ・ライブラリ構成を維持する
- 既存の動作確認済み導線を壊さない
- 問題データの既存JSON構造を不用意に壊さない
- チケット1〜44の実装済み機能を壊さない
- 今後の起動・確認URLは `http://127.0.0.1:8000/` を標準とする
- 変更後は対象JSファイルに対して `node --check` を実行する

# チケット45: ゲーム画面の背景画像設定

## 目的

ゲームプレイ画面が黒背景のみで殺風景なので、`E:\Dev\web_picross_Ver2\image` 配下のJPEG画像をゲーム画面の背景として表示できるようにする。

背景画像はあくまでも最背面レイヤーとして扱い、ゲーム盤面、ボタン、タイマー、パレット、操作系UIに干渉しないようにする。

## 対象ファイル（推定）

- `E:\Dev\web_picross_Ver2\js\state.js`
- `E:\Dev\web_picross_Ver2\js\config.js`
- `E:\Dev\web_picross_Ver2\js\render.js`
- `E:\Dev\web_picross_Ver2\js\actions.js`
- `E:\Dev\web_picross_Ver2\styles.css`
- `E:\Dev\web_picross_Ver2\README.md`

必要に応じて新規作成:

- `E:\Dev\web_picross_Ver2\image\README.md`

## 実装内容

### 1. ゲーム画面に背景レイヤーを追加する

ゲーム画面の最背面に背景画像用レイヤーを追加する。

仕様:

```text
- 背景画像はゲーム画面の最背面に配置する
- UI、盤面、タイマー、ボタン、パレットより後ろに表示する
- 背景画像は画面全体を覆う
- 背景画像がゲーム操作に干渉しないようにする
```

CSS方針:

```css
pointer-events: none;
z-index: 0;
background-size: cover;
background-position: center;
background-repeat: no-repeat;
```

UI側は背景より前面に出す。

```css
position: relative;
z-index: 1;
```

### 2. 画像パスを設定化する

背景画像のパスをコード内に分散させず、設定として管理する。

設定候補:

```js
gameBackgroundImage: "image/game_background.jpg"
```

または画面別背景設定として以下のようにしてもよい。

```js
backgrounds: {
  game: "image/game_background.jpg"
}
```

### 3. JPEG画像を対象にする

対象画像は `image` フォルダ内の `jpg` / `jpeg` ファイルを想定する。

例:

```text
E:\Dev\web_picross_Ver2\image\game_background.jpg
E:\Dev\web_picross_Ver2\image\game_bg_01.jpeg
```

### 4. 背景を暗めに表示する

そのまま貼るのではなく、ゲームUIが読みやすいように明るさを抑える。

実装方法はどちらでもよい。

#### 方法A: 背景レイヤーにfilterを指定

```css
filter: brightness(45%);
```

#### 方法B: 黒の半透明オーバーレイを重ねる

```css
background: rgba(0, 0, 0, 0.45);
```

推奨:

```text
背景画像 + 黒半透明オーバーレイ
```

理由:

```text
- 画像ごとの明るさ差に対応しやすい
- 盤面や文字の視認性を保ちやすい
```

### 5. ゲーム操作に干渉させない

背景レイヤーには必ず以下を設定する。

```css
pointer-events: none;
```

これにより、背景画像をクリックしても、ゲーム盤面やボタン操作に影響しないようにする。

### 6. 既存UIの視認性を維持する

背景画像を入れても以下が見えること。

```text
- 残り時間
- 全消去
- 判定
- ヒント
- ギブアップ
- メニューへ戻る
- セレクトに戻る
- 盤面
- ヒント数字
- パレット
- 操作説明
```

必要であれば、既存パネル背景の透明度を調整する。

## 受け入れ条件

- `http://127.0.0.1:8000/` で確認できる
- ゲーム画面の背景に `image` フォルダ内のJPEG画像が表示される
- 背景画像は最背面に表示される
- タイマー、ボタン、盤面、パレットが背景より前面に表示される
- 背景画像がクリック操作に干渉しない
- 左クリック、右クリック、ドラッグ操作が壊れない
- 背景が暗めに表示され、UIが読める
- 背景画像が画面サイズに合わせて自然に拡大縮小される
- 既存のゲーム画面レイアウトが大きく崩れない
- `node --check js/state.js` が通る
- `node --check js/config.js` が通る
- `node --check js/render.js` が通る
- `node --check js/actions.js` が通る
- 変更したJSファイルすべてで `node --check` が通る

## 確認手順

```bat
cd /d E:\Dev\web_picross_Ver2
npm start
```

確認URL:

```text
http://127.0.0.1:8000/
```

確認内容:

```text
ログイン
→ メニュー
→ ゲームセレクト
→ 任意の問題を開始
→ ゲーム画面の背景画像が表示される
→ 盤面・ボタン・タイマーが読める
→ 左クリックで塗れる
→ 右クリックで×が置ける
→ ドラッグ操作ができる
→ 背景がクリック操作に干渉しない
```

## 最終報告

```text
- 変更したファイル
- 背景画像の設定場所
- 使用する画像パス
- 背景の暗さ調整方法
- pointer-events: none の適用箇所
- node --check の結果
- http://127.0.0.1:8000/ での確認結果
- 未確認事項または注意点
```
