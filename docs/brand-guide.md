# YutaiGO デザインガイド（v0.1）

ブランドの見た目・声のトーンをそろえるための最小ガイドです。今後のUI改善や素材作成時はこのガイドをベースにしてください。

## ブランド
- サービス名: 株主優待管理アプリ YutaiGO
- ロゴ: `public/brand/logo-yutaigo.svg`（ワードマーク + チケットアイコン）
- トーン&マナー: 親しみやすい / すっきり / 実用的（派手すぎない）

## カラー
- プライマリ（ブランド）: `#2563EB`（YutaiGO Blue）
- セカンダリ: `#14B8A6`（Teal）
- アクセント: `#F59E0B`（Amber）
- 成功/警告/エラー: `#10B981` / `#F59E0B` / `#EF4444`
- サーフェス/背景（Light）: `#FFFFFF` / `#F9FAFB`
- サーフェス/背景（Dark）: `#0B1220` / `#111827`
- テキスト（Light/Dark）: `#111827` / `#F9FAFB`

補足:
- Tailwind 設定では `brand` を既に使用（`#2563EB`）。必要に応じてシェードを追加してください。

### 例: Tailwind のトークン拡張（参考）
```js
// tailwind.config.js (参考例)
extend: {
  colors: {
    brand: {
      50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
      400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
      800: '#1E40AF', 900: '#1E3A8A', DEFAULT: '#2563EB'
    }
  },
  borderRadius: { md: '8px', lg: '12px', xl: '16px' }
}
```

## タイポグラフィ
- 日本語本文: Noto Sans JP（推奨）/ System UI 代替可
- 見出し（英数字比重が高い箇所）: Inter（推奨）
- 代替スタック例:
  - `font-family: Inter, Noto Sans JP, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;`
- ウェイト: 400（本文）/ 600（見出し）
- 行間: 1.5（本文）

## レイアウト/スペーシング
- 8px グリッド（4の倍数で調整）
- 角丸: 8px（標準）、12–16px（カード/モーダル）
- 影: 控えめ（Card は薄めのシャドウ + 境界線）

## コンポーネント（最小規約）
- Button
  - Primary: brand 背景 + 白文字
  - Secondary: brand 50/100 背景 + brand 700 文字
  - Outline: 枠線 + テキストは brand 600
- Link
  - brand 600、ホバーで下線
- Card
  - 白/濃色サーフェス、8–12px 角丸、1px ボーダー
- Badge
  - 情報: gray / 注意: amber / 警告: red / 成功: green

## ロゴの使い方
- ファイル: `public/brand/logo-yutaigo.svg`
- 余白: ロゴ高さの 0.5 倍を四辺に確保
- 最小サイズ: 横 120px 以上推奨
- 反転ロゴ: 暗い背景では白版（SVG の `fill=white` に置換可）

## アセット
- アイコン: シンプルな 2色（brand + neutral）の線画を推奨
- 画像: 角丸 8–12px、影薄め、色数は抑制

## 運用
- デザインの追加要件はこのガイドを更新（PR）
- UI 実装時は Tailwind のトークン/ユーティリティで一貫性を担保

---
このガイドを初版とし、UIの実装に合わせて随時アップデートしてください。

