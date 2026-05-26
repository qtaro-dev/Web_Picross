# Web Picross

ブラウザで遊べるWeb版ピクロスです。  
既存のWebピクロスをポートフォリオ掲載用にリニューアルし、静的Webアプリとして動作するようにしています。

## 概要

- HTML / CSS / JavaScriptのみで構成
- ローカルサーバー起動で動作
- JSON形式の問題データを読み込み
- 難易度別の問題選択
- モノクロ / カラーパズル対応を拡張中
- エディタ機能でパズル作成・保存・読み込みに対応中

## 主な機能

- タイトル画面
- メニュー画面
- ゲームセレクト画面
- 難易度別パズル一覧
- ピクロス盤面表示
- 左クリックで塗り
- 右クリックで×マーク
- 左ドラッグで連続塗り
- 右ドラッグで連続×
- 塗りと×の排他制御
- 全消去
- 判定
- ヒント
- ギブアップ
- 難易度別タイマー
- エディタモード
- JSON読み込み / 出力
- エディットプレイ
- オプション画面
- ヘルプ画面
- クレジット画面

## ビルドナンバー

- ビルドナンバーは `js/config.js` の `BUILD_INFO` で管理します。
- チケット50時点の初期ビルドは `Build #0000050` です。
- チケット修正・訂正・編集のたびに +1 します。
- 現在のビルドは `Build #0000106` です。

## 公開構成方針

- 公開先はVercel、永続データと素材管理はSupabaseへ段階移行する方針です。
- Vercelには `index.html`、`styles.css`、`js/`、`docs/`、公開してよい設定だけを置きます。
- Supabase Databaseには `profiles`、`puzzles`、`user_progress`、`play_history`、`ranking_records` を置きます。
- Supabase Storageには `web-picross-assets` バケットを作り、`bgm/`、`se/`、`backgrounds/`、`title/`、`thumbnails/` に素材を分けます。
- `users.json`、`user/*.json`、service role key、DBパスワードはGitHub/Vercelへアップロードしません。
- 詳細は `docs/supabase/000_architecture_plan.md`、`docs/supabase/001_schema.sql`、`docs/supabase/002_rls.sql`、`docs/supabase/003_storage_design.md` を参照します。

## Supabase環境変数

Supabase接続は `js/supabaseClient.js` で管理します。未設定時はSupabaseへ接続せず、既存のローカルJSON / localStorage 動作へフォールバックします。

ローカル用の雛形は `.env.example` を使います。`.env` と `.env.*` はGit管理しません。

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

VercelではProject SettingsのEnvironment Variablesへ次の2つを設定します。

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY`、DBパスワード、JWT secretはフロントエンド、GitHub、Vercelの公開環境変数へ置きません。

Supabase設定済みの場合、既存のログイン画面からSupabase Authへ登録・ログインします。`profiles` には `username`、`display_name`、`role` を保存し、ログイン成功時のユーザー情報は `state.currentUser` に `loginSource: "supabase"` として保持します。Supabase未設定時は従来のローカルログインに戻ります。固定ユーザー `admin` / `admin` は開発用です。

Supabase Authでは正規のメールアドレス + パスワードで登録・ログインします。登録時はユーザー名、メールアドレス、パスワードを入力し、ログイン時はメールアドレスとパスワードを使います。ユーザー表示と `profiles.username` には入力されたユーザー名を保存します。

Supabase Authentication のEmail Providerでは、メール確認（Confirm email）を有効にしてください。アプリは登録後に確認メールの案内を表示し、確認済みでないSupabaseユーザーをログイン成功として扱いません。ログイン画面から確認メールを再送できます。

Authentication のURL Configurationには、ローカル確認用の `http://127.0.0.1:8000/` と公開環境のアプリURLをRedirect URLとして登録してください。既存ユーザーのメール確認状態はAuthentication → Usersで確認し、未確認ユーザーにはログイン画面の再送導線から確認を完了してもらいます。

管理者ページはSupabase Authログインかつ `profiles.role = admin` のユーザーだけに表示します。初期管理者は次の手順で作成します。

1. Supabase Dashboardを開きます。
2. Table Editor → profiles を開きます。
3. 管理者にしたいユーザーの `role` を `user` から `admin` に変更します。
4. アプリに再ログインします。
5. メニューに「管理者ページ」が表示されることを確認します。

管理者ページではユーザー一覧、進行状況、プレイ履歴、ランキング記録、デバッグ操作、システム情報を確認できます。上部のセクションボタンで各管理領域へ移動でき、左下の矢印ボタンでページ上部へ戻れます。表示名・権限・進行状況・ランキングタイムの更新とランキング記録削除は、Supabase RLSで許可された範囲だけ実行します。service role keyはフロントエンドでは使用しません。F1デバッグクリアはSupabase管理者ユーザー専用です。ランキングの非表示フラグ、備考、F1デバッグクリアの `debug_clear` 分離は現スキーマに無いため後続チケットで扱います。

管理者ページの「パスワードクリア」は、対象ユーザーの `profiles.password_clear_required` を有効にします。対象ユーザーは次回のSupabaseログイン後、通常メニューやゲームへ進まず、新しいパスワードの設定を完了する必要があります。更新完了時は `password_clear_required` を解除して `last_password_changed_at` を保存し、一度サインアウトします。本実装は既存RLSにより認証済み管理者が状態を更新する方式で、管理者がAuthパスワードを直接参照・上書きする処理やservice role keyのブラウザ配布は行いません。

エディタはSupabase管理者ユーザー専用です。通常メニュー列には「お知らせ」を表示し、管理者だけがメニュー右側のショートカットからエディタと管理者ページを開けます。一般ユーザーが内部的にエディタ遷移を呼び出した場合も、メニューへ戻して利用を拒否します。

ログイン画面の「パスワードを忘れた場合」から、Supabase Authのパスワード再設定メールを要求できます。登録有無を推測されにくくするため、要求後の表示は入力メールが登録済みの場合に送信するという共通案内です。メール内リンクでアプリへ戻ると新パスワード設定画面を表示し、更新完了後はセッションを終了して新しいパスワードでのログインを求めます。管理者ページでは、管理者だけがユーザー詳細から登録メール宛に同じ再設定メールを送信できます。管理者がパスワードを取得または直接変更する機能はありません。

ユーザーデータ画面のアカウント削除は、この画面から直接削除せず、`account_delete_requests` テーブルへ削除申請を保存します。同一ユーザーの申請中レコードは重複作成しません。管理者ページでは申請一覧、pending件数、承認・拒否、管理者メモを確認できますが、Authユーザーの実削除は行いません。実削除は後続の管理者専用機能で扱います。

管理者が削除申請を承認した場合、現段階ではAuthユーザーを物理削除せず、`profiles.account_status = disabled`、`disabled_at`、`disabled_reason` を保存して利用停止として扱います。利用停止ユーザーはゲームセレクト、ゲーム開始、エディットプレイへ進めず、プレイ記録やランキング記録も保存しません。管理者ページのユーザー詳細から、`disabled` ユーザーだけを `active` に戻す利用停止解除もできます。service role keyはフロントエンドへ出さず、Authユーザーの物理削除は将来のサーバー側処理として検討します。

利用停止ユーザーがSupabaseログインを試みた場合は、検出直後にサインアウトしてログイン画面に留めます。メニュー、ユーザーデータ、ゲーム、管理者ページには遷移せず、ログイン画面に利用停止メッセージを表示します。

削除申請まわりの集計値は `profiles` の `delete_request_count`、`delete_approved_count`、`delete_rejected_count`、`account_disabled_count`、`account_reactivated_count` と最終日時列に保存します。既存環境へ列を追加した場合は、Supabase SQL Editorで `NOTIFY pgrst, 'reload schema';` を実行してからアプリを再読み込みしてください。

Supabaseで `profiles` に `account_status` などの列を追加した直後に画面へ反映されない場合は、SQL Editorで `NOTIFY pgrst, 'reload schema';` を実行してPostgRESTのスキーマキャッシュを更新してください。

パスワードクリア機能には `profiles` の `password_clear_required`、`password_clear_requested_at`、`password_clear_requested_by`、`password_clear_count`、`last_password_changed_at` 列が必要です。[docs/supabase/001_schema.sql](docs/supabase/001_schema.sql) の追加定義を適用し、既存の `profiles_update_own_or_admin` RLSポリシーが有効であることを確認してください。ローカル確認でも実ユーザーのログイン制御が変わるため、テストユーザーだけで実行してください。

ローカル `npm start` でSupabase Authを確認する手順:

1. `E:\Dev\web_picross_Ver2\.env` を作成します。
2. `SUPABASE_URL` と `SUPABASE_ANON_KEY` を設定します。
3. `npm start` でローカルサーバーを起動します。
4. `http://127.0.0.1:8000/api/supabase-config` を開き、`configured: true` になることを確認します。
5. アプリで新規ユーザー登録します。
6. Supabase Dashboard の Authentication → Users にユーザーが増えることを確認します。
7. Supabase Dashboard の Table Editor → public → profiles に `username` が増えることを確認します。

`.env` が未設定または空の場合、`/api/supabase-config` は `configured: false` を返し、既存のローカル登録・ログインへフォールバックします。

Supabaseログイン中は、クリア、時間切れ、ギブアップ時に `user_progress` と `play_history` へ記録します。クリア時は `ranking_records` へベストタイムも保存します。F1デバッグクリアは `profiles.role = admin` のSupabase管理者ユーザーだけが利用でき、既存仕様と同じく通常クリア扱いで記録します。

パズルデータは `npm run import:puzzles` で `data/*.json` からSupabase Databaseの `puzzles` へインポートできます。インポートにはローカル `.env` の `SUPABASE_SERVICE_ROLE_KEY` を使いますが、このキーはGitHub/Vercel/フロントエンドへ置きません。アプリ側はSupabase設定済みなら `puzzles.is_published = true` の問題だけを取得し、未設定時は従来どおり `data/*.json` を読み込みます。

## 起動方法

このアプリは `fetch()` で `data/*.json` を読み込むため、`index.html` を直接開くのではなく、ローカルサーバー経由で起動します。

静的版の確認だけなら次のコマンドで起動できます。静的版では固定ユーザー `admin` / `admin` でログインできますが、ユーザー登録のファイル保存APIは動きません。

```bash
python -m http.server 8000 --bind 127.0.0.1
```

ユーザー登録を `users.json` に保存するローカル開発用APIも使う場合は、次のコマンドで起動します。

```bash
node server.js
```

起動後、ブラウザで以下を開きます。

```text
http://127.0.0.1:8000/
```

## ログイン

- 開発用固定ユーザー: `admin` / `admin`
- ユーザー名は1〜10文字で、日本語・英数字・`_`・`-` を使えます。
- メールアドレスは50文字以内で、メールアドレス形式のみ受け付けます。
- 登録・パスワード変更時のパスワードは8〜16文字の半角英数字・記号です。弱いパスワードでも原則ブロックせず、画面上の強度メーターで注意を表示します。
- パスワード欄には表示 / 非表示ボタンがあり、入力内容を確認できます。貼り付けやパスワードマネージャーの自動入力は妨げません。
- `node server.js` 起動時は、ログイン画面のユーザー登録ボタンから登録したユーザーを `users.json` に保存します。
- 現在のユーザー保存は開発用の平文パスワードです。本番公開ではハッシュ化や外部DB連携が必要です。
- ユーザー登録成功後は、登録したユーザー名とパスワードをログインフォームへ転記する確認モーダルを表示します。
- 「メールアドレスとパスワードを記録する」をONにしてログインすると、ブラウザ側 `localStorage` にログイン情報を保存し、次回ログイン画面で復元します。OFFでログインすると保存済みログイン情報を削除します。
- ログイン情報記録機能はローカル開発・ポートフォリオ確認用です。現在はユーザー名・パスワードをブラウザ側に平文保存するため、本番運用では使用せず、Supabase Auth等の認証基盤へ移行する想定です。
- Live ServerなどAPIのない静的環境では、ユーザー登録情報を `localStorage` の `picross_v2_users` に保存します。
- クリア状況とクリアタイムはユーザー別に `localStorage` の `picross_v2_user_data` に保存します。
- メニュー画面の「ユーザーデータ」から、現在ユーザーの基本情報、難易度別集計、各面のクリア/失敗/ギブアップ記録を確認できます。
- 通常のユーザーデータ画面では、内部ID、保存キー、権限、JSON出力、データ削除などの管理・デバッグ情報は表示しません。管理者向け操作は後続の管理者専用ページで扱う方針です。
- 静的環境のユーザー保存は開発確認用です。本番向け認証ではなく、将来的にはSupabaseなどのDB連携へ置き換える想定です。
- `python -m http.server` やVSCode Live Serverでは静的配信のみのため、`users.json` へ直接保存できません。
- `node server.js` 起動時は `/api/register` 経由で `users.json` に登録ユーザーを保存し、`/api/user-data` で保存内容を確認できます。
- ゲームセレクトの完成サムネイルは、現在ログイン中のユーザーがその問題をクリア済みの場合だけ表示します。未クリア問題はプレースホルダー表示です。

## オプション・ヘルプ・クレジット

- オプション画面では、クロスヘア色、BGM音量、SE音量、表示モードを設定できます。
- オプション設定はブラウザ側 `localStorage` の `web_picross_options` に保存します。
- BGM / SE音源は未実装ですが、音量設定UIのみ先に用意しています。
- 表示モードのフルスクリーンはブラウザのFullscreen APIを使い、ボーダーレスはWeb版の疑似表示モードとして扱います。
- ヘルプ画面にはピクロスの基本ルール、操作方法、カラーピクロス、ユーザーデータの説明を掲載しています。
- クレジット画面はCSSアニメーションで下から上へ流れるループ表示です。

## エディタJSON

- `beginner.json` / `easy.json` / `normal.json` / `hard.json` / `endless.json` をエディタで読み込むと、ファイル名に応じて難易度と盤面サイズ候補を自動設定します。
- 1つのJSONファイルには1つの難易度のみ含めます。複数難易度が混在するJSONや、固定ファイル名と中身の難易度が一致しないJSONは読み込み・出力を中断します。
- 難易度ごとの盤面サイズ候補は `js/config.js` の `BOARD_SIZE_OPTIONS_BY_DIFFICULTY` で管理します。

## ゲーム操作補助

- ヒントは対象行または列の正解セルと×を同時に表示します。
- ヒント回数は難易度ごとに、ビギナー2回、イージー3回、ノーマル3回、ハード5回、エンドレス5回です。
- やりなおしは入力、×、ヒント表示、タイマー、ヒント残数を初期状態に戻します。
- 判定では、間違い数と未入力数を表示します。
- ゲーム画面には盤面の縮小・拡大ボタンがあります。セルサイズ自体を変更するため、クリックやドラッグ位置はずれません。
- カラーパレットは使用色のみを表示し、ゲーム中は色ID文字を表示しません。
- クリア後にOKでゲーム画面へ戻った場合も、盤面操作はロックしたまま、メニュー・セレクトへの移動は確認なしで行えます。

## デバッグ機能

- ゲームプレイ中に `F1` キーを押すと、Supabase管理者ユーザー専用の開発・動作確認用機能として現在の面を即時クリアできます。
- 未ログイン、一般ユーザー、ローカル保存ユーザー、固定ユーザー `admin` / `admin` ではF1即時クリアは無効です。
- F1即時クリアは通常クリアと同じ記録処理を通り、クリアダイアログ、ユーザーデータ、ランキング、クリア済み表示に反映されます。
- この機能は `js/config.js` の `DEBUG_CONFIG.enableF1InstantClear` でON/OFFできます。

## ランキング表示

- ランキング画面ではネタバレ防止のため、パズル名を表示しません。
- ランキングAPIのレスポンスには互換性維持のためパズル名を残し、画面表示だけ非表示にしています。

## 背景画像

- ゲーム画面、メニュー画面、ランキング画面、ログイン画面、ゲームセレクト画面、オプション画面、ヘルプ画面、クレジット画面、ユーザーデータ画面、エディタ画面は `image` フォルダ内のJPEG画像を背景として表示します。
- 背景画像の設定は `js/config.js` の `BACKGROUNDS` にまとめています。
- 現在の設定は、メニュー `./image/back001.jpg`、ゲーム `./image/back002.jpg`、ランキング `./image/back003.jpg`、ログイン `./image/back004.jpg`、ゲームセレクト `./image/back005.jpg`、オプション `./image/back006.jpg`、ヘルプ `./image/back007.jpg`、クレジット `./image/back008.jpg` / `./image/back009.jpg` / `./image/back001.jpg`、ユーザーデータ `./image/back010.jpg`、エディタ `./image/back011.jpg` です。
- クレジット画面は3枚の背景を9秒間隔で切り替え、約2秒でフェードイン・フェードアウトします。
- 背景は最背面レイヤーとして表示し、黒の半透明オーバーレイで暗めにしています。
- 背景レイヤーは `pointer-events: none` のため、盤面クリック、右クリック、ドラッグ、フォーム入力、メニュー操作、ランキング操作には干渉しません。
- 背景画像が読み込めない場合も、既存の黒背景と前面UIはそのまま表示されます。

## ユーザーデータ保存

Node.jsサーバー起動時:

- `user/<username>.json` にユーザー別データを保存します。
- ログイン成功時にユーザーデータを作成または読み込みます。固定ユーザー `admin` も例外扱いせず、`user/admin.json` を準備します。
- ユーザー情報、全体集計、各面の進行状況、プレイ履歴を保存します。
- クリア時はクリア回数、最新クリアタイム、ベストタイム、クリア日時を保存します。
- 時間切れなどの失敗時は失敗回数と最新失敗時間を保存します。
- ギブアップ時はギブアップ回数と最新ギブアップ時間を保存します。
- ランキングはSupabase設定時に `ranking_records` を参照し、難易度ごとにクリア時間が短い順で最大100件表示します。
- ランキング画面では、クリア時間、ユーザー名、面番号、クリア日時と、現在ログイン中ユーザーの順位を表示します。ネタバレ防止のためパズル名は表示しません。
- Supabase未設定または取得失敗時は、Node.jsサーバーのランキングAPI、さらに現在ユーザーの `localStorage` 内データへフォールバックします。
- F1即時クリアはSupabase管理者ユーザーだけが利用でき、通常クリアと同じ保存処理を通るため、Supabase利用時も `ranking_records` の対象になります。
- 日時データは、内部処理・ソート用のISO形式と、画面確認用のローカル日時文字列を併記します。例: `clearedAt: 2026-05-18T05:23:16.665Z` / `clearedAtText: 2026/05/18 14:23:16`。
- `user/*.json` は `.gitignore` で除外しています。

Live Server / 静的環境:

- ブラウザから `user` フォルダへ直接保存できないため、`localStorage` に保存します。
- ログイン成功時に `picross_v2_user_data` 上へ現在ユーザーの初期データを作成または読み込みます。
- クリア時、時間切れ時、ギブアップ時の記録タイミングはNode.jsサーバー起動時と同じです。
- JSON出力には `createdAtText`、`updatedAtText`、`clearedAtText` などの表示用日時も含めます。既存データに表示用日時がない場合は、画面表示時にISO日時から変換します。
- 将来的にはSupabase / PostgreSQL等のDB保存へ移行する想定です。
