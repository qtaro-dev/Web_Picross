# チケット142：既存パズルのpuzzle_key命名を統一

## 目的

現在のパズル管理では、Supabase側の `puzzles.id` はUUID主キーとして扱い、JSON側の `id` は管理用の `puzzle_key` として扱っている。

一方で、初期に作成した一部パズルでは、JSON内の `id` が `"1"` / `"2"` のような単純な番号のまま残っている。

例：

```json
{
  "id": "1",
  "stageNo": 1,
  "title": "とけい",
  "difficulty": "normal",
  "mode": "mono"
}
```

現在の命名ルールに近い新しいパズルでは、以下のような `difficulty` / `mode` / 連番を含むキーが使われている。

```json
{
  "id": "normal_color_id00000004",
  "stageNo": 4,
  "title": "おんなのこ",
  "difficulty": "normal",
  "mode": "color"
}
```

このままでもゲーム表示自体は動くが、管理画面の `puzzle_key` が `1` / `2` のように表示され、後から見たときにどの難易度・種別のパズルなのか分かりにくい。

このチケットでは、既存パズルの `puzzle_key` 命名を安全に統一する方針を確認し、JSONとSupabase側の扱いを壊さない形で整理する。

## 対象ファイル（推定）

- `data/beginner.json`
- `data/easy.json`
- `data/normal.json`
- `data/hard.json`
- `data/endless.json`
- `js/admin.js`
- `js/data.js`
- `api/admin-upload-puzzles.js`
- `scripts/importPuzzlesToSupabase.js`
- `README.md`
- `docs/ticket_status.json`

## 実装前の確認事項

### 1. 現在のpuzzle_key仕様を確認する

まず、既存コード上で以下を確認する。

- JSONの `id` がどこで `puzzle_key` として扱われているか
- Supabaseの `puzzles.id` UUIDとJSON `id` の関係
- 管理画面のアップロード前チェックで、`id` 変更が「追加」扱いになるか「更新」扱いになるか
- `user_progress` / `ranking_records` / `play_history` などが、UUID側を参照しているか、JSON `id` 側を参照しているか
- 既存クリア状況やランキングに影響しないか

### 2. 既存Supabaseデータへの影響を確認する

JSON側の `id` を変更すると、Supabase上で以下のどちらになるか確認する。

- 既存パズルの `puzzle_key` 更新として扱われる
- 別パズルとして追加される

別パズルとして追加される場合、単純なJSON修正だけでは既存パズルが重複する可能性があるため、実装を止めて報告する。

### 3. 既存データ移行方針を決める

安全な移行方針として、以下のどちらがよいか確認する。

#### 方針A：JSONのみ命名統一し、Supabase再投入で更新できる場合

- JSONの `id` を正式形式に変更
- 管理画面またはインポートスクリプトで再投入
- 既存UUIDは維持
- 既存進捗・ランキングも維持

#### 方針B：Supabase側のpuzzle_key更新SQLが必要な場合

- JSONの `id` を正式形式に変更
- 既存Supabase `puzzles.puzzle_key` を更新するSQLを作成
- UUIDは変更しない
- `user_progress` / `ranking_records` などUUID参照データは維持
- SQLはユーザーが手動適用する前提で、適用順と影響範囲をREADMEまたはdocsに明記

#### 方針C：重複リスクが高いため今回は調査のみ

- 現状の `1` / `2` を維持
- READMEとチケットメモに「古い初期パズルは番号キーのまま残す」と明記
- 将来のデータ移行チケットへ分離

## 実装内容

### 1. 古い形式のJSON idを洗い出す

`data/*.json` を確認し、以下のような古い形式の `id` を一覧化する。

- `"1"`
- `"2"`
- `"3"`
- その他、難易度や種別が分からない単純ID
- 現在の命名規則と異なるID

一覧には以下を含める。

- 対象ファイル
- stageNo
- title
- difficulty
- mode / colorMode
- 現在のid
- 変更候補id

例：

```text
data/normal.json
stageNo: 1
title: とけい
mode: mono
current id: 1
new id: normal_mono_id00000001
```

### 2. 新しい命名規則を定義する

今後の `puzzle_key` 命名規則をREADMEまたは該当docsに明記する。

候補：

```text
{difficulty}_{mode}_id{8桁連番}
```

例：

```text
beginner_mono_id00000001
beginner_color_id00000002
easy_color_id00000003
normal_mono_id00000001
normal_color_id00000004
hard_color_id00000008
endless_color_id00000001
```

注意：

- `stageNo` と連番が一致する必要があるか確認する
- 既存データとの整合を優先する
- すでに使われている命名規則がある場合は、それに合わせる
- ハードコード文字列を増やさず、既存の定数・命名関数があるなら活用する

### 3. JSON idを安全に更新する

影響調査の結果、JSON側の更新で問題ない場合のみ、対象JSONの `id` を正式形式に変更する。

例：

```json
"id": "1"
```

を

```json
"id": "normal_mono_id00000001"
```

へ変更する。

注意：

- `stageNo`
- `title`
- `difficulty`
- `mode`
- `colorMode`
- `w`
- `h`
- `grid`
- `grid_strings`

は不要に変更しない。

### 4. Supabase既存DB向けの移行SQLを必要に応じて作成する

既存DBで `puzzle_key` を更新する必要がある場合は、移行SQLを追加する。

候補ファイル：

```text
docs/supabase/013_normalize_puzzle_keys.sql
```

SQL方針：

- `puzzles.id` UUIDは変更しない
- 対象の `puzzle_key` のみ変更する
- `difficulty` / `stage_no` / `title` / `mode` などで対象を絞る
- 誤更新を避けるため、対象件数確認用SELECTをコメントまたは別SQLとして含める
- 実行後に確認できるSELECTも含める

例の考え方：

```sql
-- 確認
select id, puzzle_key, difficulty, stage_no, title, mode
from public.puzzles
where difficulty = 'normal'
  and puzzle_key in ('1', '2');

-- 更新例
update public.puzzles
set puzzle_key = 'normal_mono_id00000001'
where difficulty = 'normal'
  and stage_no = 1
  and title = 'とけい'
  and puzzle_key = '1';
```

注意：

- 実DBへ自動適用しない
- SQLはユーザーがSupabase Dashboardから手動適用する
- 適用前後の確認手順をREADMEまたは報告に含める

### 5. 管理画面の表示を確認する

管理画面のパズル管理で、古い `1` / `2` が正式な `puzzle_key` に変わることを確認する。

OK例：

```text
normal_mono_id00000001
normal_color_id00000002
```

NG例：

```text
1
2
```

### 6. 重複登録を防ぐ

今回の修正で最も重要なのは、既存パズルを重複登録しないこと。

以下を確認する。

- 同じタイトル・stageNo・難易度のパズルが二重に増えない
- 既存UUIDを持つパズルが維持される
- `puzzle_key` だけが意図どおり更新される
- アップロード前チェックで「追加」扱いになっていないか確認する
- 追加扱いになる場合は、反映実行せずに止める

### 7. READMEとticket_statusを更新する

READMEに以下を追記する。

- JSONの `id` はSupabase上の管理用 `puzzle_key`
- Supabaseの `puzzles.id` UUIDとは別物
- 今後の推奨命名規則
- 初期に作った番号キーを正式キーへ整理したこと
- 実DBにSQL適用が必要な場合、その適用ファイル名と確認方法

`docs/ticket_status.json` にチケット142を追加または更新する。

## 受け入れ条件（目視確認基準）

### JSON確認

1. `data/*.json` を確認する。
2. 古い単純IDが残っていないか確認する。

OK：

- 対象の `"id": "1"` / `"id": "2"` などが正式な `puzzle_key` 形式になっている。
- `grid` や `grid_strings` は不要に変わっていない。

NG：

- 単純IDが残っている。
- パズル内容が意図せず変わっている。

### 管理画面アップロード前チェック

1. 管理者でログインする。
2. 管理者ページを開く。
3. パズル管理を開く。
4. 対象難易度のJSONを選択する。
5. 「アップロード前チェック」を押す。

OK：

- `puzzle_key` に正式形式のIDが表示される。
- 既存パズルが意図せず「追加」扱いにならない。
- 件数・stageNo・タイトル・種別が想定どおり。

NG：

- `puzzle_key` が `1` / `2` のまま。
- 既存パズルが大量に追加扱いになる。
- 同じタイトル・stageNoが重複して表示される。

### Supabase既存DB移行SQL確認

SQLを作成した場合のみ確認する。

1. Supabase Dashboardを開く。
2. SQL Editorで確認用SELECTを実行する。
3. 対象件数を確認する。
4. 問題なければ移行SQLを実行する。
5. 実行後SELECTで結果を確認する。

OK：

- 対象の古い `puzzle_key` だけが更新される。
- UUIDの `id` は変わらない。
- `user_progress` / `ranking_records` など既存データに影響しない。
- 管理画面で正式キーとして表示される。

NG：

- UUIDが変わる。
- 既存進捗やランキングが消える。
- 別のパズルまで更新される。
- 同じパズルが重複登録される。

### ゲーム画面確認

1. 通常ゲーム画面を開く。
2. 対象難易度を選択する。
3. 対象パズルを開く。

OK：

- 既存パズルが通常どおり表示される。
- 盤面・ヒント・色が変わっていない。
- クリア済み情報やランキングが維持される。

NG：

- パズルが消える。
- パズルが重複して表示される。
- 盤面内容が変わる。
- クリア状況やランキングが消える。

### 回帰確認

以下を軽く確認する。

- Beginner / Easy / Normal / Hard / Endless の一覧表示
- モノクロ問題
- カラー問題
- エディタJSON出力
- パズル管理のアップロード前チェック
- Supabase反映実行前の差分表示
- ランキング表示
- ユーザー進捗表示

OK：

- 既存機能が従来どおり動作する。

NG：

- `puzzle_key` 命名変更により、既存機能が壊れる。
