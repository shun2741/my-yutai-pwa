# 動画自動生成（最小構成）

このプロジェクトには、画面キャプチャ→ffmpeg 合成で 30 秒の紹介動画（16:9/9:16）を生成する最小フローが含まれます。

## 構成
- キャプチャ: Playwright (Chromium)
- 合成: ffmpeg（Ken Burns 風ズーム、タイトルテロップ）
- 音声: 任意で `assets/voiceover-ja.mp3`、BGM は `assets/bgm.mp3` を同梱するとミックスされます

## ローカル実行

1) 依存をインストール

```
npm install
```

2) 画面キャプチャ

```
SITE_URL=https://<user>.github.io/my-yutai-pwa npm run video:capture
```

3) 動画レンダリング

```
npm run video:render
```

出力: `scripts/video/dist/yutaigo-16x9.mp4`, `yutaigo-9x16.mp4`

メモ:
- 任意で `assets/bgm.mp3` / `assets/voiceover-ja.mp3` を置くと音声が合成されます
- フォントは GitHub Actions の Ubuntu 既定フォントを指しています（DejaVuSans）。ローカルでずれる場合は `scripts/video/render.mjs` の `FONT` を変更してください

## GitHub Actions での自動生成

ワークフロー: `.github/workflows/video.yml`

- 手動実行（workflow_dispatch）: `site_url` を入力して実行
- タグ push（v*）で自動実行したい場合は、リポジトリ Variables に `VIDEO_AUTO=true` を設定
- 既定 SITE_URL を Variables に設定するには `SITE_URL=https://<user>.github.io/my-yutai-pwa`

成果物は `Actions > 該当Run > Artifacts` からダウンロードできます。

## カスタマイズ
- シーン配分（秒数）やテキストは `scripts/video/render.mjs` の `build()` 内を編集
- 9:16 は別レンダリングで最適化しています（1080x1920）。画面キャプチャは同一でもOK

