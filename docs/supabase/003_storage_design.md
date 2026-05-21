# Supabase Storage設計

## バケット

```text
web-picross-assets
```

公開済みゲーム素材を配信するためのバケット。読み取りは公開、アップロード・更新・削除は管理者または移行スクリプトだけが行う。

## フォルダ構成

```text
web-picross-assets/
├─ bgm/
├─ se/
├─ backgrounds/
├─ title/
└─ thumbnails/
```

| フォルダ | 用途 | 現在の移行元 |
| --- | --- | --- |
| `bgm/` | メニュー、ゲーム中などのBGM | `bgm_se/*.mp3` |
| `se/` | セル操作、判定、クリアなどの効果音 | 今後追加するSE |
| `backgrounds/` | 画面背景 | `image/back*.jpg` |
| `title/` | タイトルロゴ、タイトル素材 | `image/title.png` |
| `thumbnails/` | 問題サムネイル、プレースホルダー | `image/thumbs/` |

## 命名ルール

- ファイル名は半角英数字、ハイフン、アンダースコアだけを使う。
- 空白、日本語、環境依存文字は使わない。
- 難易度名は `beginner`, `easy`, `normal`, `hard`, `endless` に統一する。
- 面番号は3桁ゼロ埋めにする。
- 差し替えがあり得る素材は用途名を先頭に付ける。

```text
bgm/menu_bgm.mp3
bgm/game_bgm.mp3
se/cell_fill.wav
se/cell_cross.wav
se/game_clear.wav
se/game_fail.wav
backgrounds/menu_bg_01.jpg
backgrounds/game_bg_01.jpg
backgrounds/select_bg_01.jpg
title/title_logo.png
thumbnails/beginner_001.jpg
thumbnails/easy_001.jpg
thumbnails/normal_001.jpg
thumbnails/hard_001.jpg
thumbnails/endless_001.jpg
```

## 公開/非公開方針

- `web-picross-assets` は公開読み取りを前提にする。
- 公開ゲーム内で直接表示・再生する素材だけを入れる。
- 未公開素材、作業途中素材、PSDなどの編集元ファイルは入れない。
- アップロード、更新、削除はSupabase管理画面、管理者用ツール、またはservice roleを使う移行スクリプトだけで行う。
- service role keyはブラウザ、GitHub、Vercelの公開環境変数へ置かない。

## 画像圧縮方針

| 種別 | 推奨形式 | サイズ目安 |
| --- | --- | --- |
| 背景画像 | JPGまたはWebP | 長辺1920px以下、品質75〜85、500KB以下を目標 |
| タイトル画像 | PNGまたはWebP | 透過が必要ならPNG、800KB以下を目標 |
| サムネイル | JPGまたはWebP | 320px四方以内、100KB以下を目標 |
| プレースホルダー | PNGまたはWebP | 320px四方以内、100KB以下を目標 |

背景画像は画面全体に敷くため、見た目が崩れない範囲で軽量化する。サムネイルは一覧表示で多数読み込むため、背景より強めに圧縮する。

## 音声ビットレート方針

| 種別 | 推奨形式 | サイズ目安 |
| --- | --- | --- |
| BGM | MP3 | 128〜192kbps、1曲5MB以下を目標 |
| SE | WAV、OGG、MP3 | 1ファイル300KB以下を目標 |

BGMはループ再生を想定し、先頭と末尾の無音をできるだけ削る。SEは短く、音量差が大きくなりすぎないように調整する。

## 既存ファイルの移行例

| 既存パス | Storageパス |
| --- | --- |
| `bgm_se/game001.mp3` | `bgm/game_bgm.mp3` |
| `image/back001.jpg` | `backgrounds/menu_bg_01.jpg` |
| `image/back002.jpg` | `backgrounds/game_bg_01.jpg` |
| `image/title.png` | `title/title_logo.png` |
| `image/thumbs/_placeholders/beginner.png` | `thumbnails/placeholders/beginner.png` |

移行完了まではローカルパス参照を維持し、Storage URLへの切り替えは画面単位で段階的に行う。
