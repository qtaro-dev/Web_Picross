# 共通前提

- AGENT.md が存在する場合、その内容を最優先で遵守する
- 実装・修正はすべて AIエージェント が行う
- 既存設計・既存テーマ・ライブラリ構成を破壊しない
- チケット1〜64、およびチケット64fixの実装済み機能を壊さない
- ローカル確認URLは `http://127.0.0.1:8000/` を標準とする
- Supabase Databaseにはパズルデータ、ユーザーデータ、クリア記録、ランキングを置く
- Supabase StorageにはBGM、SE、背景画像、タイトル画像、サムネイル画像などの素材ファイルを置く
- `user/*.json`、`users.json`、秘密鍵、service role key、DBパスワードはGitHub/Vercelへアップロードしない
- フロントエンドで使うのは公開可能なAnon Keyのみとする
- 変更後は対象JSファイルに対して `node --check` を実行する
- ビルドナンバー運用が実装済みの場合、今回の修正分としてビルド番号を +1 する

# チケット64fix2: Supabase Auth登録時の内部メールアドレス形式を修正する

## 目的

チケット64fixにより、ローカル `npm start` 環境で `/api/supabase-config` は正常に取得できるようになった。

しかし、Supabase Auth登録時に以下のようなエラーが発生している。

```text
/auth/v1/signup 400 Bad Request
Email address "test_supabase_01@web-picross.local" is invalid
```

原因は、ユーザー名から生成しているSupabase Auth用の内部メールアドレスが `.local` ドメインになっており、Supabase Auth側で不正なメールアドレスとして拒否されているため。

ユーザー画面上はこれまで通り `ユーザー名 + パスワード` のまま維持しつつ、Supabase Authへ渡す内部メールアドレスだけを有効な形式に変更する。

## 現在確認できている状態

```text
- /api/supabase-config は configured:true を返している
- .env は読み込まれている
- Supabase Authへの通信自体は発生している
- /auth/v1/signup で 400 Bad Request
- Supabase Authentication → Users にはユーザーが増えていない
- Supabase Table Editor → profiles にもユーザーが増えていない
```

## 対象ファイル（推定）

```text
E:\Dev\web_picross_Ver2\js\supabaseAuth.js
E:\Dev\web_picross_Ver2\js\supabaseClient.js
E:\Dev\web_picross_Ver2\js\actions.js
E:\Dev\web_picross_Ver2\js\config.js
E:\Dev\web_picross_Ver2\README.md
```

必要に応じて:

```text
E:\Dev\web_picross_Ver2\server.js
E:\Dev\web_picross_Ver2\api\supabase-config.js
```

## 実装内容

### 1. usernameから生成する内部メールアドレスのドメインを変更する

現在のような形式を使わない。

```text
{username}@web-picross.local
```

以下のような、Supabase Authで拒否されにくい通常形式に変更する。

```text
{username}@web-picross.example.com
```

または:

```text
{username}@users.web-picross.example.com
```

推奨:

```text
{username}@web-picross.example.com
```

### 2. 内部メール生成処理を関数化する

`js/supabaseAuth.js` に、usernameから内部メールアドレスを作る処理がある場合は関数化する。

例:

```js
function createInternalEmailFromUsername(username) {
  const normalizedUsername = normalizeUsernameForEmail(username);
  return `${normalizedUsername}@web-picross.example.com`;
}
```

### 3. usernameをメールローカル部として安全な文字に正規化する

Supabase Authへ渡すメールアドレスのローカル部に使えない文字が混ざる可能性があるため、正規化する。

方針:

```text
- 英数字
- ドット .
- アンダースコア _
- ハイフン -
```

を許可し、それ以外は `_` などへ置換する。

例:

```text
test_supabase_01 → test_supabase_01
テストユーザー → user_ハッシュ値、または test_user など
user name → user_name
```

ただし、既存のユーザー名表示自体は変更しない。  
Supabase Auth用の内部メールだけ正規化する。

### 4. usernameと内部メールの対応が一貫するようにする

登録時とログイン時で同じusernameから同じ内部メールが生成されるようにする。

必須:

```text
登録時: test_supabase_01 → test_supabase_01@web-picross.example.com
ログイン時: test_supabase_01 → test_supabase_01@web-picross.example.com
```

登録時とログイン時で違うメールが作られるとログインできなくなるため、共通関数を使う。

### 5. profilesには元のusernameを保存する

Supabase Auth用の内部メールはあくまで内部処理用。

`profiles` にはユーザーが入力した元のusernameを保存する。

保存例:

```text
username: test_supabase_01
display_name: test_supabase_01
role: user
```

必要であれば、内部メールもデバッグ用に保存してよいが、ユーザー表示には使わない。

### 6. 登録失敗時のエラー表示を分かりやすくする

Supabase Auth登録に失敗した場合、画面またはconsoleに原因が分かるようにする。

例:

```text
ユーザー登録に失敗しました: Email address ... is invalid
```

またはconsole:

```text
Supabase signup failed: Email address ... is invalid
```

ただし、秘密情報やキーは出力しない。

### 7. 登録成功後にSupabase Dashboardで確認できるようにする

登録成功後、以下にデータが作られること。

```text
Supabase Dashboard
→ Authentication
→ Users
```

次に:

```text
Supabase Dashboard
→ Table Editor
→ public
→ profiles
```

### 8. 既存ローカルフォールバックを壊さない

Supabase設定が無い場合、または `/api/supabase-config` が `configured:false` の場合は、既存ローカル登録・ログインへフォールバックする。

維持するもの:

```text
- 固定 admin/admin
- 既存 /api/login
- 既存 /api/register
- users.json / user/*.json を使うローカル開発挙動
```

## 受け入れ条件

```text
- http://127.0.0.1:8000/api/supabase-config が configured:true を返す状態で確認できる
- 新規ユーザー登録時に /auth/v1/signup 400 invalid email が出ない
- Supabase Authentication → Users に新規ユーザーが増える
- Supabase Table Editor → public → profiles に元のusernameが保存される
- 登録したユーザー名とパスワードでログインできる
- 画面上のユーザー表示は内部メールではなくusernameのまま
- 登録時とログイン時で同じ内部メール生成処理を使っている
- Supabase未設定時は既存ローカル登録・ログインが壊れない
- service role keyやDB passwordを扱っていない
- node --check が変更したJSファイルすべてで通る
```

## 確認手順

### 1. サーバ再起動

```bat
cd /d E:\Dev\web_picross_Ver2
npm start
```

### 2. Supabase設定確認

ブラウザで開く。

```text
http://127.0.0.1:8000/api/supabase-config
```

期待結果:

```json
{
  "configured": true
}
```

### 3. 新規ユーザー登録

アプリを開く。

```text
http://127.0.0.1:8000/
```

新規ユーザー例:

```text
username: test_supabase_64_fix2
password: test1234
```

### 4. Console確認

ブラウザDevTools Consoleで以下が出ないこと。

```text
Email address "...@web-picross.local" is invalid
/auth/v1/signup 400 Bad Request
```

### 5. Supabase Dashboard確認

```text
Authentication
→ Users
→ 新規ユーザーが増えていること
```

次に:

```text
Table Editor
→ public
→ profiles
→ username = test_supabase_64_fix2 が増えていること
```

### 6. ログイン確認

一度ログアウトし、登録したユーザーでログインする。

```text
username: test_supabase_64_fix2
password: test1234
```

期待結果:

```text
- ログインできる
- メニュー画面へ進める
- 画面上の表示名が username になる
```

## 最終報告

```text
- 変更したファイル
- 内部メールアドレス生成ルール
- .localドメインを廃止したこと
- username正規化処理の内容
- 登録時とログイン時で共通関数を使っている確認
- Supabase Authentication Users確認結果
- profiles確認結果
- 登録ユーザーでログインできた確認結果
- Supabase未設定時のfallback確認結果
- service role keyやDB passwordを扱っていない確認結果
- node --check の結果
- 未確認事項または注意点
```
