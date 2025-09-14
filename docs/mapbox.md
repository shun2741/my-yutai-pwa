# Mapbox タイルへの切り替えメモ（Leaflet）

このアプリはデフォルトで OSM タイルを使用しますが、`NEXT_PUBLIC_MAPBOX_TOKEN` を設定すると Mapbox のスタイルで描画します。未設定時は自動で OSM にフォールバックします。

## 使い方（ローカル）
1. Mapbox アカウントを作成し、アクセストークン（Public Token）を取得
2. `.env.local` に追記（コミットしないでください）
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.XXXXXXXXXXXXXXXXXXXXXXXX
# 任意: スタイルを変更（デフォルト: mapbox/streets-v12）
NEXT_PUBLIC_MAPBOX_STYLE=mapbox/streets-v12
```
3. `npm run dev`

## 使い方（GitHub Pages 本番）
- リポジトリ Settings → Secrets and variables → Actions → Variables に追加
  - `NEXT_PUBLIC_MAPBOX_TOKEN=pk.XXXX`
  - 必要なら `NEXT_PUBLIC_MAPBOX_STYLE=mapbox/streets-v12`
- 既存の Pages デプロイワークフローで自動注入（env に追記してもらう形でも可）

## 請求と安全運用のヒント
- 無料枠: 執筆時点の無料枠では静的サイトの個人利用で十分（最新の料金表は Mapbox 公式を確認）
- トークン制限: Mapbox のアカウント設定でトークンの「使用上限」「許可ドメイン（URL）」を設定
- タイル負荷抑制:
  - 本実装は 256px タイル + `@2x` を利用（高解像度だが枚数は節度あり）
  - `maxZoom` は 20 に制限
  - SW の画像キャッシュはブラウザ任せ（当アプリのSWは Next資産中心）。必要なら domain ごとに無効化可
- フォールバック: トークン未設定時は OSM を使用（事故でトークンが無くても地図が動作）

## 実装
- `src/app/map/page.tsx`
  - `NEXT_PUBLIC_MAPBOX_TOKEN` があれば `https://api.mapbox.com/styles/v1/${style}/tiles/256/{z}/{x}/{y}@2x?access_token=...` を使用
  - attribution に Mapbox / OSM を明記

## スタイル例
- `mapbox/streets-v12`（既定）
- `mapbox/outdoors-v12`
- `mapbox/dark-v11`（ダークテーマ併用時に検討可）

---
困ったときは `.env.local` を空にして OSM に戻してください。

