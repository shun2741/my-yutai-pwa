外部URLカタログ（分離リポ方式）

概要
- このアプリとは別リポでカタログ（companies/chains/stores → catalog.json）を生成・公開します。
- 本アプリは公開URLの manifest と catalog.json を取得して同期します。

本アプリ側の設定
- GitHub Actions → Variables に `CATALOG_BASE` を追加
  - 値例: `https://<your-user>.github.io/yutai-catalog`
- 既にワークフローで `NEXT_PUBLIC_CATALOG_BASE: ${{ vars.CATALOG_BASE }}` をビルドに注入済み
- 未設定なら従来通り `public/catalog` を参照

カタログ側（別リポ）の要件
- `dist/` に下記ファイルを公開
  - `catalog-manifest.json` … { version, hash, url }
  - `catalog-YYYY-MM-DD.json` … { version, companies[], chains[], stores[] }
  - JSONはこのアプリの schema に準拠

推奨: pipeline リポの構成
- `data/` … 管理CSV（companies.csv, chains.csv, stores.csv）
- `src/pipeline/` … 生成/検証スクリプト
- `dist/` … 出力（Pagesで配信）
- `.github/workflows/pages.yml` … 生成→Pagesデプロイ

運用
- CSVを更新 → main に push → CI が `dist/` を生成し Pages に公開（公開URLのルート直下に配置）→ このアプリは起動/フォーカスで同期
- 初回やテストで差分を出したい場合は companies.csv にダミー行（例: comp-seed）を追加すると manifest の hash が変わります
