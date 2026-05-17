# Picross v2 (Module Skeleton)

これは「処理の箱」をつないでいく構成で作った最小テンプレです。中身はブラックボックスのままでも運用できます。

## 使い方
1. フォルダを展開してローカルサーバーを起動する。
   - 例: `python -m http.server 8000 --bind 127.0.0.1`
   - ブラウザで `http://127.0.0.1:8000/` を開く。
   - VS Code の Live Server でも可。
   - `index.html` を `file://` で直接開くと、問題データの `fetch` が失敗する場合があります。
2. 見た目を変えたい → `styles.css` を編集。
3. 画面にボタンやUIを増やしたい → まずは `render.js` に追加して、操作は `actions.js` に関数を作る。

## ファイル役割
- `index.html` … 入口（`js/main.js` を1回読むだけ）
- `styles.css` … 見た目
- `js/state.js` … 今の状態（モード・盤サイズ・塗り情報など）
- `js/rules.js` … ルールや定数（モード別の推奨サイズなど）
- `js/render.js` … 画面を作るだけ（ロジックは書かない）
- `js/actions.js` … クリック等の操作→ state を変えて `render()`
- `js/packs.js` … パックデータの出入口（あとで fetch に置き換え）
- `js/main.js` … 「配線図」。state・packs を actions に渡して初期描画

## 次のステップ例
- `packs.js` を `fetch('/data/packs/beginner.json')` に差し替え（404時は `state.error` にメッセージを出す）
- 難易度やページングのUIを `render.js` に追加し、動作は `actions.js` に生やす（例: `actions.nextPage()`）
- HTML から直接呼びたい場合は `main.js` の `window.App` を有効化して、`<button onclick="App.actions.clear()">` のように使用
