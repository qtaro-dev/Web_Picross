# チケット108：管理者ページから難易度別パズルJSONをアップロードできる機能

## 背景

現在の通常パズルデータは、リポジトリ内の静的JSON `data/*.json` が元データとして存在している。

対象ファイル例：

- `data/beginner.json`
- `data/easy.json`
- `data/normal.json`
- `data/hard.json`
- `data/endless.json`

実装上は、Supabase設定済みの場合、アプリはSupabase Databaseの `puzzles` テーブルを優先して読み込み、取得失敗または未設定時のみ `data/*.json` にフォールバックする。

現在、DBへの投入は `scripts/importPuzzlesToSupabase.js` を使って行う構成であり、管理者ページから通常パズルデータをアップロードしてDBへ反映する導線は存在しない。

今後、ビギナー以外の問題を少しずつ追加していく予定があるため、毎回全難易度を一括更新するのではなく、難易度ごとにJSONをアップロードして更新できる管理機能が必要。

## 目的

管理者ページに「パズルデータアップロード」機能を追加し、管理者が難易度ごとに `data/*.json` 相当のJSONをアップロードして、Supabaseの `puzzles` テーブルへ反映できるようにする。

## 対象ファイル（推定）

- `api/admin-upload-puzzles.js`
- `api/_adminGuard.js`
- `js/admin.js`
- `js/actions.js`
- `js/render.js`
- `js/data.js`
- `js/config.js`
- `docs/supabase/001_schema.sql`
- `README.md`
- `docs/vercel_supabase_production_checklist.md`
- `docs/ticket_status.json`
- 必要に応じて `scripts/importPuzzlesToSupabase.js` の共通化または参考利用

## DB変更方針

Supabase `puzzles` テーブルに、人間向けの管理用ID列を追加する。

推奨列：

```sql
alter table public.puzzles
add column if not exists puzzle_key text;
```

既存データに対しては、既存の `difficulty` と `stage_no` から `puzzle_key` を補完する。

例：

```sql
update public.puzzles
set puzzle_key = difficulty || lpad(stage_no::text, 5, '0')
where puzzle_key is null;
```

補完例：

```text
beginner + stage_no 1 → beginner00001
easy + stage_no 1 → easy00001
normal + stage_no 5 → normal00005
hard + stage_no 8 → hard00008
endless + stage_no 1 → endless00001
```

一意制約または一意indexを追加する場合は、既存データの重複確認後に行うこと。

推奨：

```sql
create unique index if not exists puzzles_difficulty_puzzle_key_unique
on public.puzzles (difficulty, puzzle_key)
where puzzle_key is not null;
```

注意：

```text
既存の puzzles.id uuid 主キーは変更しない。
既存のランキング・進行状況・履歴が参照している可能性があるため、puzzles.id の値を再生成・置換しない。
JSON側の id は、DB主キーではなく puzzle_key として扱う。
```

## 実装内容

### 1. 管理者ページに「パズル管理」セクションを追加

管理者ページに、難易度別のパズルJSONアップロードUIを追加する。

表示項目：

- 難易度選択
  - beginner
  - easy
  - normal
  - hard
  - endless
- JSONファイル選択
- アップロード前チェックボタン
- 反映実行ボタン
- 検証結果表示欄

管理者以外には表示しないこと。

### 2. 難易度ごとのアップロード方式にする

一度に全難易度を更新するのではなく、選択した難易度だけを対象にする。

例：

```text
difficulty = beginner を選択
beginner.json をアップロード
→ beginner のパズルだけ検証・反映
```

他の難易度のDBデータは変更しないこと。

### 3. JSON形式

アップロードできるJSON形式は、既存の `data/*.json` と同等にする。

対応形式：

```json
[
  {
    "id": "beginner_mono_id00000001",
    "stageNo": 1,
    "title": "クロス",
    "difficulty": "beginner",
    "mode": "mono",
    "colorMode": "mono",
    "w": 5,
    "h": 5,
    "grid": [["0", "1"]],
    "grid_strings": ["00100"],
    "updatedAt": "..."
  }
]
```

既存読み込み処理と同じく、以下の互換形式も可能であれば受け付ける。

- 配列直下: `[...]`
- ラッパー形式: `{ "puzzles": [...] }`
- サイズ: `w/h` または `width/height`
- 正解盤面: `grid` / `grid_strings` / `solution` / `cells`
- タイトル: `title` または `name`
- 難易度: `difficulty` または `level`

ただし、実装が大きくなりすぎる場合は、まず既存 `data/*.json` と同じ形式を最優先にする。


### 3.1. 管理用パズルID（puzzle_key）を追加する

既存のSupabase `puzzles.id` は `uuid` 主キーとして維持する。

`puzzles.id` を `beginner00001` などの人間向けIDに置き換えないこと。

代わりに、管理者やJSONアップロード時に識別しやすい管理用IDとして、別列を追加する。

推奨列名：

```text
puzzle_key
```

例：

```text
beginner00001
beginner00002
easy00001
normal00005
hard00008
endless00001
```

目的：

```text
uuid主キーは既存のランキング・進行状況・履歴との関連を壊さないため維持する
puzzle_key は人間が見て分かりやすい管理用IDとして使う
JSONアップロード時の照合・更新にも puzzle_key を利用できるようにする
```

JSON側の `id` は、DB主キーの `puzzles.id` には入れず、原則として `puzzle_key` として扱う。

例：

```json
{
  "id": "beginner00001",
  "stageNo": 1,
  "title": "クロス",
  "difficulty": "beginner",
  "mode": "mono",
  "colorMode": "mono",
  "w": 5,
  "h": 5,
  "grid_strings": ["00100"]
}
```

DB側の扱い：

```text
puzzles.id → uuid主キー。既存列を維持。
puzzles.puzzle_key → beginner00001 などの管理用ID。
```

制約の推奨：

```text
difficulty + puzzle_key は一意
difficulty + stage_no も一意、または少なくとも同一難易度内で重複させない
```

既存データ移行時は、既存の `difficulty` と `stage_no` から `puzzle_key` を補完する。

この補完は既存 `puzzles.id` を変更せずに行うこと。

### 4. サーバーAPIを追加

管理者専用APIを追加する。

推定API：

```text
POST /api/admin-upload-puzzles
```

認証・認可：

- 未ログインは401
- 一般ユーザーは403
- 管理者のみ実行可能
- 既存の `_adminGuard.js` を利用すること
- `SUPABASE_SECRET_KEY` はサーバー側のみで使用し、ブラウザには出さないこと

リクエスト内容：

```json
{
  "difficulty": "beginner",
  "puzzles": [...]
}
```

### 5. アップロード前検証

DB反映前に、サーバー側でJSONを検証する。

検証項目：

- `difficulty` が許可値である
- アップロード対象難易度と各パズルの難易度が一致する
- `id` または `puzzle_key` が空ではない
- `stageNo` が数値である
- `title` が空ではない
- `width` / `height` または `w` / `h` が数値である
- 正解盤面が存在する
- 正解盤面の行数・列数がサイズと一致する
- 同一JSON内で `id` / `puzzle_key` が重複しない
- 同一JSON内で `stageNo` が重複しない
- 件数が0件の場合は反映しない

検証に失敗した場合、DBは変更しないこと。

### 6. DB反映方式

DB反映は、削除ではなく安全な更新方式にする。

推奨方式：

```text
同一 difficulty + puzzle_key が存在する場合 → 更新
puzzle_key が無い既存データは difficulty + stage_no で照合して更新
存在しない場合 → 追加
アップロードJSONに含まれない既存パズル → 削除せず is_published=false にする
```

目的は、ランキングや進行状況など既存パズルIDに紐づくデータを壊さないこと。

既存設計上、DBの `puzzles.id` はuuid主キーであるため、JSON側の `id` をDB主キーへ直接入れないこと。JSON側の `id` は `puzzle_key` として扱い、既存のuuid主キーは維持すること。

必要であれば、既存の `scripts/importPuzzlesToSupabase.js` のマッピング方式を確認し、同じ列変換を使うこと。

DB列への変換目安：

```text
JSON id → puzzle_key
difficulty → difficulty
stageNo → stage_no
title → title
w / width → width
h / height → height
colorMode → color_mode
palette → palette
grid_strings / grid / solution / cells → solution
is_published → true
updated_at → now()
```

### 7. 確認画面・結果表示

アップロード実行前に、管理者が内容を確認できるようにする。

表示例：

```text
対象難易度: beginner
アップロード件数: 20
追加予定: 2
更新予定: 18
非公開予定: 0
エラー: 0
```

初回実装で追加・更新・非公開予定の厳密な差分計算が難しい場合は、最低限以下を表示する。

```text
対象難易度
読み込んだ件数
検証OK/NG
先頭数件の stageNo / title
```

### 8. 誤操作防止

DB反映前に確認モーダルを表示する。

文言例：

```text
選択した難易度のパズルデータをSupabaseへ反映します。
アップロードJSONに含まれない既存パズルは非公開になります。
実行してよろしいですか？
```

### 9. エラー時の挙動

以下の場合はDBを変更しない。

- JSON parse失敗
- 難易度不一致
- 必須項目不足
- stageNo重複
- id / puzzle_key重複
- gridサイズ不一致
- Supabase更新エラー

エラー時は、管理者画面に原因を表示する。

### 10. ドキュメント更新

以下を更新する。

- README
- 本番チェックリスト
- `docs/ticket_status.json`

`ticket_status.json` には `108` を追加する。

Build番号も更新すること。

## 受け入れ条件（目視確認基準）

### puzzle_key確認

1. Supabaseの `puzzles` テーブルを見る
2. 既存パズルに `puzzle_key` が補完されているか確認する

OK：

```text
puzzles.id はuuidのまま維持される
puzzle_key に beginner00001 などの人間向けIDが入っている
同一 difficulty 内で puzzle_key が重複しない
```

NG：

```text
puzzles.id が beginner00001 などの文字列に置き換わる
既存uuidが再生成される
ランキング・進行状況との紐づきが壊れる
```

### 管理者ページ表示

1. `AdminQtaro` でログインする
2. 管理者ページを開く
3. パズル管理セクションを見る

OK：

```text
パズルJSONアップロード用のUIが表示される
難易度を選択できる
JSONファイルを選択できる
```

NG：

```text
一般ユーザーにも表示される
難易度を選べない
どの難易度に反映されるのか分からない
```

### beginnerのみアップロード

1. 難易度 `beginner` を選択する
2. `data/beginner.json` と同等形式のJSONを選択する
3. アップロード前チェックを実行する
4. 検証OKを確認する
5. 反映実行する

OK：

```text
beginner のパズルだけが更新される
easy / normal / hard / endless は変更されない
問題一覧で beginner が表示できる
```

NG：

```text
他難易度まで変更される
beginner の問題一覧が壊れる
```

### 難易度不一致チェック

1. 難易度 `easy` を選択する
2. `beginner.json` をアップロードする

OK：

```text
難易度不一致としてエラーになる
DBは変更されない
```

NG：

```text
easy として beginner の問題が登録される
DBが中途半端に更新される
```

### 不正JSONチェック

壊れたJSON、空配列、必須項目不足のJSONをアップロードする。

OK：

```text
検証エラーが表示される
DBは変更されない
```

NG：

```text
画面が固まる
DBが一部だけ更新される
```

### 本番反映後の表示

1. アップロード後、一般ユーザーまたは管理者で通常問題一覧を開く
2. 対象難易度を見る
3. 更新したパズルが表示されるか確認する

OK：

```text
対象難易度の問題一覧にアップロード内容が反映される
パネルクリックで通常通りプレイできる
クリアできる
ランキング・進行状況が壊れない
```

NG：

```text
問題一覧が表示されない
クリックしてもゲーム開始できない
正解盤面が壊れている
既存の進行状況が消える
```

## 備考

このチケットでは、パズルエディタ自体の大幅改修は行わない。

対象は、既存または外部で作成したパズルJSONを、管理者ページから難易度別にSupabaseへ反映する機能の追加とする。

全難易度一括アップロードは、事故時の影響範囲が大きいため本チケットでは扱わない。
