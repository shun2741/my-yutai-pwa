# 株主優待管理PWA 要件定義 v0.1
日付: 2025-08-30

## 1. 目的
- 株主優待（企業ごとの優待）をユーザー端末内で管理し、期限を見失わないようにする。
- どのチェーン/店舗で利用できるかをカタログ（共有データ）で提示し、店舗マップで探索できるようにする。

## 2. 対象・配布・利用端末
- 初期ユーザー: 開発者本人（将来は公開）。
- 配布: PWA（GitHub Pages）。
- 主端末: スマホ。PCは管理用途（将来UI追加）で、当面は設定ファイル配布で代替可。

## 3. 保存方針・コスト
- 個人データは **端末ローカル（IndexedDB）** のみ。同期なし。
- ホスティング: GitHub Pages、地図: Mapbox（無料枠）。

## 4. 機能（MVP）
- 画面タブ: **ホーム / 優待券 / マップ / 設定**。
- 優待券（保有データ）:
  - 新規登録/編集/削除。
  - 入力: 会社名（カタログから選択のみ/A案）、券種（食事/金券/割引/その他）、期限（日付）、金額（整数円・ポイント等も金額扱い）、メモ（任意）、株数（整数/任意）。
  - 一覧: 期限の昇順表示、残日数 <30 = 赤、<90 = 黄の背景。
  - 残金額の修正が可能（消化後に金額を更新）。
- マップ:
  - 起動時に現在地中心。許可NG時は東京駅（139.767125, 35.681236）。
  - カタログ stores をピン表示、ポップアップに店舗名。
  - 初期は全件ピン（重くなれば将来クラスタリング）。
- 設定:
  - **JSONのエクスポート/インポート**（schemaVersion 付き）。
- ホーム:
  - カタログ起動時同期の結果をトースト表示（「優待データを更新しました」）。
  - 「今月期限の優待 x件」バナー（軽リマインド）。
- PWA:
  - manifest / service worker（App Shell: CacheFirst、/catalog* : StaleWhileRevalidate）。

## 5. カタログ（共有データ）
- 構造: **優待企業 → チェーン → 店舗**（1チェーンは通常1社）。
- 配信: `catalog-manifest.json`（version/hash/url） + `catalog-YYYY-MM-DD.json`。
- 同期: 起動/フォアグラウンド復帰で manifest を no-store 取得→ hash 差分で本体取得→ IndexedDB 更新。
- 更新ルール: **随時、全入れ替え**（破壊的変更は version 切り替え）。

## 6. データモデル（概要）
- Holding（端末ローカル）
  - `id, companyId, companyName, voucherType, expiry, amount?, shares?, note?, createdAt, updatedAt`
  - 金額は「残」金額を保持し、編集で更新できる。
- Catalog（共有）
  - `version, companies[], chains[], stores[]`
  - Company: `id, name, ticker?, chainIds[], voucherTypes[], notes?`
  - Chain: `id, companyIds[], displayName, category, tags[], voucherTypes[], url?`
  - Store: `id, chainId, name, address, lat, lng, tags[], updatedAt`

## 7. UX/バリデーション
- 会社名はオートコンプリートから選択（**カタログ外は登録不可**）。
- 金額: 整数円、0以上（ポイントも円換算）。
- 株数: 整数（任意）。
- 期限: YYYY-MM-DD。ユーザーは後から変更可。削除は confirm で確認。
- アクセシビリティ: label/aria, フォーカス可視、タップ余白。

## 8. インポート/エクスポート仕様
- JSONトップに `schemaVersion` を含む。
- 内容: `holdings, catalog, catalog_meta` を含む完全バックアップ。
- インポート時は既存クリア→投入→リロード。

## 9. 受け入れ基準（MVP Done）
- オフラインで優待券の登録/閲覧/編集（金額・期限）/削除が可能。
- 起動時カタログ同期で差分があれば反映＆トースト表示。
- マップで catalog.stores がピン表示される。
- JSONのエクスポート/インポートが動作。
- PWAとしてインストール可能（HTTPS, manifest, SW）。
- ホームに「今月期限の優待 x件」バナーが表示される。

## 10. 今後の拡張（非MVP）
- 企業/チェーン/カテゴリでの絞り込み・検索（Fuse.js）。
- ピンのクラスタリング、店舗詳細。
- 画像添付、バックアップ先のクラウド連携。
- 将来のクラウド同期/通知強化。

