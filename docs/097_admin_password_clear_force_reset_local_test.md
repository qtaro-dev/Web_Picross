# チケット97：管理者によるパスワードクリアと次回ログイン時パスワード再設定

## 背景

管理者ページから、対象ユーザーのパスワードを管理者判断でクリア扱いにし、次回ログイン時にユーザーへ新しいパスワード設定を促せるようにしたい。

現在は、ユーザー自身によるパスワード再設定メール送信、管理者による再設定メール送信、再設定リンク後の新パスワード設定画面は実装済み。

ただし、管理者がユーザー対応を行う場面では、メール再設定だけでなく、管理者画面上で対象ユーザーを「パスワードクリア状態」にし、次回ログイン時に新パスワード設定へ誘導できる機能が欲しい。

また、当初はローカル環境での実行制限も検討したが、動作確認が困難になるため、自己責任の開発運用としてローカルでもパスワードクリア機能をテストできるようにする。

## 目的

管理者ページから対象ユーザーを「パスワードクリア状態」に変更できるようにする。

対象ユーザーは次回ログイン時、通常メニューへ進まず、新しいパスワードを設定する専用画面へ誘導される。

新パスワード設定完了後、パスワードクリア状態を解除し、通常利用できる状態に戻す。

ローカル環境でも、必要な環境変数とローカルAPIを用意すれば、実際にパスワードクリアの一連動作を確認できるようにする。

## 重要方針

### 1. 管理者向け文言は「パスワードクリア」でよい

管理者ページ上のボタン・確認モーダル・完了メッセージでは、管理者が理解しやすいように以下の文言を使用してよい。

```text
パスワードクリア
```

ただし、実装上は Supabase Auth のパスワードを空文字や NULL にするのではなく、アプリ側で「次回パスワード再設定が必要な状態」を管理する。

### 2. フロントに service role key を置かない

Supabase Auth Admin API を使う場合、service role key / secret key は絶対にフロントエンドへ出さない。

ローカルテストでも本番運用でも、service role key は以下のようなサーバー側環境変数にだけ置く。

```text
.env
Vercel Environment Variables
Supabase Edge Functions Secrets
```

禁止事項:

```text
js/config.js に service role key を書く
ブラウザに読み込まれるJSへ service role key を書く
HTMLへ service role key を埋め込む
GitHubへ service role key をコミットする
```

### 3. ローカルでも実操作テストできるようにする

このチケットでは、ローカルでもパスワードクリアの実操作テストを可能にする。

ローカルテスト条件:

```text
ローカル専用 .env に SUPABASE_SERVICE_ROLE_KEY を設定する
.env は .gitignore で除外する
ローカルサーバーAPIからのみ service role key を読む
フロントからはローカルAPIを呼び出すだけにする
```

ローカルでも、管理者ユーザーかどうかの検証は必須とする。

### 4. 本番デプロイ後も同じAPI構造を使う

Vercelへデプロイした後は、同じAPI構造を本番環境で利用する。

本番では Vercel の環境変数へ `SUPABASE_SERVICE_ROLE_KEY` を設定する。

ローカルと本番で処理経路が大きく変わらないようにし、差分を最小化する。

## 対象ファイル

推定対象:

```text
js/admin.js
js/actions.js
js/render.js
js/supabaseAuth.js
js/state.js
js/config.js
styles.css
README.md
docs/ticket_status.json
docs/supabase/001_schema.sql
.gitignore
```

ローカルAPI / Vercel Functions を使う場合の追加候補:

```text
api/admin-clear-password.js
api/admin-update-user-password.js
```

ローカルサーバー側の実装が必要な場合の追加候補:

```text
server.js
local-api/admin-clear-password.js
```

既存のサーバー構成に合わせて、最小差分で実装する。

## DB前提

以下の列は既に追加済み、または追加済み前提として扱う。

```sql
alter table public.profiles
add column if not exists password_clear_required boolean not null default false,
add column if not exists password_clear_requested_at timestamptz,
add column if not exists password_clear_requested_by uuid,
add column if not exists password_clear_count integer not null default 0,
add column if not exists last_password_changed_at timestamptz;
```

RLSポリシーも追加済み前提。

ただし、実装時に列名差異・ポリシー不足が判明した場合は、READMEまたはdocs/supabase側に追記する。

## 実装内容

### 1. 管理者ページのユーザー詳細に「パスワードクリア」ボタンを追加する

管理者ページのユーザー詳細エリアに、以下のボタンを追加する。

```text
パスワードクリア
```

表示対象:

```text
Supabase管理者ユーザーでログイン中
対象ユーザーが存在する
対象ユーザーにAuthユーザーIDが紐づいている
```

管理者自身に対して実行する場合は、誤操作防止のため確認文言を強めにする。

### 2. 確認モーダルを表示する

ボタン押下時、即実行せず確認モーダルを表示する。

表示内容:

```text
対象ユーザー名
表示名
メールアドレス
ユーザーID
```

確認メッセージ例:

```text
このユーザーをパスワードクリア状態にします。
次回ログイン時に新しいパスワードの設定が必要になります。
実行しますか？
```

### 3. パスワードクリア状態を profiles に保存する

確認後、対象ユーザーの profiles を更新する。

更新内容:

```text
password_clear_required = true
password_clear_requested_at = 現在日時
password_clear_requested_by = 実行した管理者ユーザーID
password_clear_count = password_clear_count + 1
```

更新に成功したら管理者ページの表示も更新する。

### 4. 対象ユーザーの既存パスワードを実質的に使えない状態にする

管理者が「パスワードクリア」を実行した時点で、対象ユーザーの既存パスワードでは通常ログインを継続できないようにする。

実装方式は、安全に実現できる方法を選ぶ。

候補:

```text
Auth Admin APIで対象ユーザーのパスワードをランダムな一時値へ更新する
profiles.password_clear_required = true を必ず併用する
次回ログイン後は強制再設定画面へ誘導する
```

注意:

```text
Supabase Auth のパスワードを空文字やNULLにする実装は避ける
管理者画面上の文言は「パスワードクリア」でよい
内部実装は「既存パスワード無効化 + 次回再設定必須」とする
```

### 5. 次回ログイン時に強制パスワード再設定画面へ誘導する

ログイン成功後、通常メニュー表示より前に `profiles.password_clear_required` を確認する。

`true` の場合は、通常メニュー・ゲーム画面・管理者ページへ進ませず、強制パスワード再設定画面を表示する。

画面文言例:

```text
管理者によりパスワードクリアが行われました。
新しいパスワードを設定してください。
```

入力項目:

```text
新しいパスワード
新しいパスワード確認
```

既存のパスワード強度表示・入力チェックを流用する。

### 6. 新パスワード更新後にクリア状態を解除する

新パスワード設定処理が成功したら、以下を更新する。

```text
profiles.password_clear_required = false
profiles.last_password_changed_at = 現在日時
```

以下は履歴として残してよい。

```text
password_clear_requested_at
password_clear_requested_by
password_clear_count
```

その後、セキュリティ上いったんログアウトし、ログイン画面へ戻す。

表示メッセージ:

```text
パスワードを更新しました。新しいパスワードでログインしてください。
```

### 7. ローカルAPIでも本番APIでも管理者検証を必須にする

ローカルテストであっても、API側で以下を検証する。

```text
リクエスト元ユーザーがログイン済みであること
リクエスト元ユーザーの profiles.role が admin であること
対象ユーザーIDが存在すること
対象ユーザーIDとprofilesが一致すること
```

管理者でない場合は拒否する。

表示メッセージ例:

```text
この操作は管理者専用です。
```

### 8. ローカル環境変数の扱いをREADMEへ明記する

READMEに、ローカルテスト用の注意を追記する。

記載内容:

```text
SUPABASE_SERVICE_ROLE_KEY は .env にだけ置く
.env は Git 管理しない
service role key はフロントJSへ書かない
ローカルでも実ユーザーのAuth情報を変更するため、テストユーザーで確認する
本番ユーザーでは不用意に実行しない
```

## 受け入れ条件

### 管理者ページ

AdminQtaro などの管理者ユーザーでログインする。

期待結果:

```text
ユーザー詳細に「パスワードクリア」ボタンが表示される
ボタン押下で確認モーダルが表示される
対象ユーザー情報が確認できる
```

### パスワードクリア実行

管理者が対象ユーザーに対してパスワードクリアを実行する。

期待結果:

```text
profiles.password_clear_required が true になる
password_clear_requested_at が入る
password_clear_requested_by が入る
password_clear_count が +1 される
管理者ページ上でも状態が確認できる
対象ユーザーの旧パスワードでは通常ログインできない、またはログイン後に強制再設定画面へ送られる
```

### 対象ユーザーの次回ログイン

パスワードクリア状態のユーザーでログインする。

期待結果:

```text
通常メニューへ進まない
ゲーム画面へ進まない
管理者ページへ進まない
強制パスワード再設定画面が表示される
```

### 新パスワード設定

対象ユーザーが新しいパスワードを入力して更新する。

期待結果:

```text
Supabase Auth のパスワードが更新される
profiles.password_clear_required が false になる
last_password_changed_at が入る
更新後はいったんログアウトされる
ログイン画面に戻る
新しいパスワードでログインできる
```

### ローカルテスト

ローカル環境で `.env` に service role key を設定し、テストユーザーに対して実行する。

期待結果:

```text
ローカルでもパスワードクリアを実行できる
service role key はブラウザに露出しない
テストユーザーのパスワードクリア状態を確認できる
新パスワード設定後に通常ログインへ戻れる
```

### 一般ユーザー制御

一般ユーザーは他ユーザーのパスワードクリア操作を実行できない。

期待結果:

```text
管理者ページへ入れない
内部的に処理を呼び出しても拒否される
APIを直接叩いても拒否される
```

## 確認観点

```text
管理者以外にボタンが出ないこと
管理者以外がAPIを叩いても拒否されること
service role key がフロントJSに含まれないこと
対象ユーザーIDの取り違えがないこと
パスワード再設定中に通常画面へ進めないこと
パスワード更新成功後にクリア状態が解除されること
旧パスワードで通常利用できないこと
新パスワードでログインできること
```

## メモ

このチケットでは、管理者画面上の表記としては「パスワードクリア」を使用してよい。

ただし実装上は、Supabase Auth のパスワードを空にするのではなく、以下の考え方で扱う。

```text
既存パスワードを無効化する
profiles.password_clear_required = true にする
次回ログイン時に新パスワード設定を強制する
```

ローカルでも実操作テストを許可するが、service role key は必ずサーバー側に閉じ、Git管理しない。
