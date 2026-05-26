# チケット84fix1: 管理者ページの進行状況テーブル「クリア」列修正が効いていない問題の再修正

## 目的

チケット84で対応したはずの、管理者ページの進行状況テーブルにおける `クリア` 列の縦表示問題がまだ残っているため、HTML生成側とCSSの両方を確認して確実に修正する。

## 背景

管理者ページのユーザー詳細内にある進行状況テーブルで、`クリア` 列ヘッダーがまだ以下のように縦表示になっている。

```text
ク
リ
ア
```

チケット84では以下の対応が入ったと報告されている。

```text
admin-progress-table を追加
admin-progress-clear-column を追加
min-width: 64px
width: 72px
white-space: nowrap
word-break: keep-all
中央寄せ
```

しかし実画面ではまだ直っていないため、CSSが当たっていない、または列幅指定が別要素に負けている可能性がある。

## 対象ファイル（推定）

```text
js/admin.js
js/render.js
styles.css
README.md
docs/ticket_status.json
```

## 実装内容

### 1. HTML生成側でクリア列に確実にクラスを付ける

進行状況テーブルのヘッダー `クリア` に、確実に専用クラスを付与する。

対象:

```html
<th class="admin-progress-clear-column">クリア</th>
```

チェックボックス側のセルにも同じ系統のクラスを付ける。

例:

```html
<td class="admin-progress-clear-column admin-progress-clear-cell">...</td>
```

### 2. CSSセレクタを強めて確実に適用する

既存CSSに負けないよう、管理者進行状況テーブル専用のセレクタで指定する。

例:

```css
.admin-progress-table th.admin-progress-clear-column,
.admin-progress-table td.admin-progress-clear-column {
  width: 72px;
  min-width: 72px;
  max-width: 72px;
  white-space: nowrap;
  word-break: keep-all;
  text-align: center;
}
```

必要であれば `writing-mode` も明示する。

```css
writing-mode: horizontal-tb;
```

### 3. table-layout の影響を確認する

テーブル側に `table-layout: fixed` が指定されている場合、狭い列に押し込まれている可能性がある。

以下を確認する。

```text
admin-progress-table に table-layout: fixed が付いていないか
親要素の幅不足で列が圧縮されていないか
```

必要であれば、進行状況テーブルの親要素に横スクロールを許可する。

```css
overflow-x: auto;
```

### 4. Progress Key列が幅を取りすぎていないか確認する

現在、Progress Key が長く、クリア列を圧迫している可能性がある。

対応候補:

```text
Progress Key列を折り返し表示にする
Progress Key列に max-width を設定する
テーブル全体を横スクロール可能にする
```

ただし、このチケットでは `クリア` 列が横書きになることを最優先にする。

### 5. チェックボックス表示を整える

`クリア` 列のチェックボックスが中央に表示されるようにする。

```css
.admin-progress-clear-cell {
  text-align: center;
  vertical-align: middle;
}
```

チェックボックスサイズも不自然に小さくならないようにする。

### 6. 他テーブルへの影響を防ぐ

この修正は管理者ページの進行状況テーブルのみに限定する。

影響を出してはいけない箇所:

```text
ランキング管理テーブル
プレイ履歴テーブル
ユーザー一覧テーブル
通常ランキング画面
```

## UI仕様

- `クリア` が横書きで表示される
- `クリア` が縦に折り返されない
- チェックボックスが中央に表示される
- Progress Key列が長くてもクリア列が潰れない
- 必要であれば横スクロールで表示する
- 既存テーマを壊さない
- スマホ幅でも最低限操作できる

## 受け入れ条件

- 管理者ページの進行状況テーブルで `クリア` が横書き表示になる
- `クリア` が縦に折り返されない
- `クリア` 列に専用クラスがHTML上で付与されている
- CSSが `.admin-progress-table` 配下に限定されている
- チェックボックスが列内で中央表示される
- Progress Key列が長くても `クリア` 列が潰れない
- 必要に応じて横スクロールで閲覧できる
- ランキング管理テーブルが崩れていない
- プレイ履歴テーブルが崩れていない
- ユーザー一覧テーブルが崩れていない
- 通常ゲーム画面が崩れていない
- `node --check` が通る
- ビルド番号を +1 する
- `docs/ticket_status.json` にこのチケットを追加し、初期状態を `未修整` にする

## 確認手順

```text
1. 管理者ユーザーでログイン
2. 管理者ページを開く
3. ユーザー管理で任意ユーザーの詳細を開く
4. 進行状況テーブルを確認
5. クリア列が横書きになっていることを確認
6. チェックボックスが中央にあることを確認
7. 他の管理テーブルが崩れていないことを確認
```

## 最終報告

- 変更したファイル
- HTML上で追加・修正したクラス
- CSSで追加・修正したセレクタ
- table-layout / overflow の確認結果
- クリア列の表示確認
- 他テーブルへの影響確認
- `docs/ticket_status.json` 更新内容
