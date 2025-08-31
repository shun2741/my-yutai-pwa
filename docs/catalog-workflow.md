# カタログ作成ワークフロー（CSV運用）

本書は「公式サイトの情報をもとに Companies/Chains/Stores の CSV を管理し、JSON を自動生成してデプロイする」ための手順です。

## 1. 情報の集め方（例: すかいらーく/コロワイド）

- 企業/ブランド一覧: 公式のブランドページ（例: 企業サイトの「ブランド一覧」）から、チェーン名・カテゴリ（飲食/小売/宿泊 等）・対応する企業を洗い出します。
- 店舗一覧: 公式の店舗検索ページに住所/店舗名の一覧があればCSV化。JSON API がある場合は規約に沿って取得（スクレイピングは各サイトの規約に従ってください）。
- 住所→緯度経度: 住所だけ得られる場合は、下記のジオコーディングスクリプトで lat/lng を付与します。

## 2. ID・フィールドのルール

- IDは英数字とハイフンを推奨（例: `comp-skylark`, `chain-skylark`, `store-skylark-shinjuku-01`）。
- `voucherTypes`: ["食事","金券","割引","その他"] から選択。
- `category`: ["飲食","小売","サービス","交通","宿泊","その他"]。
- 参照整合性: `chains.companyIds` は存在する `companies.id` を、`stores.chainId` は存在する `chains.id` を指すこと。

## 3. スクリプトの使い方

### 3.1 企業/チェーンの追加

1) 入力 JSON を作成（例: `inputs/skylark.json`）

```
{
  "company": {"id":"comp-skylark","name":"すかいらーく","voucherTypes":["食事"],"ticker":"","notes":""},
  "chain": {"id":"chain-skylark","displayName":"すかいらーく","category":"飲食","companyIds":["comp-skylark"],"voucherTypes":["食事"],"tags":[],"url":""}
}
```

2) 追記実行

```
npm run catalog:add:company-chain -- inputs/skylark.json
```

### 3.2 店舗CSVの追記

1) まず `stores.csv` を用意（ヘッダ固定）。lat/lng が無い場合は空欄でOK。

```
id,chainId,name,address,lat,lng,tags,updatedAt
store-skylark-shinjuku-01,chain-skylark,すかいらーく 新宿店,東京都新宿区西新宿1-1-1,,,ファミレス,2025-09-01T00:00:00Z
```

2) ジオコーディング（任意）

```
export NOMINATIM_EMAIL=you@example.com
npm run catalog:geocode -- stores.csv stores-geocoded.csv
```

3) リポジトリの `data/stores.csv` に追記

```
npm run catalog:append:stores -- stores-geocoded.csv
```

### 3.3 JSON生成と反映

```
npm run catalog:build
git add -A && git commit -m "feat(catalog): すかいらーく店舗を追加" && git push
```

CI（GitHub Actions）が `catalog:build` を自動実行し、Pagesへデプロイします。クライアントは起動/フォーカス時に差分同期します。

## 4. ベストプラクティス

- 1ブランドずつ小さく追加し、マップとフィルタで挙動確認。
- IDの安定性を重視（名称変更時もIDは不変）。
- 同日中の再生成もOK（manifestのhashが更新され、クライアントは差分検知）。
- 大量追加時は 1PR=1ブランド/1地域 程度でレビューを軽く。

## 5. 注意（法務/規約）

- 公式サイトからのデータ取得は利用規約に従ってください。自動取得する場合もレート制限/アクセスヘッダに配慮し、許可無く大量のリクエストを送らないこと。
- ジオコーディングに Nominatim を使う場合は、公開ポリシーとレート制限（1req/sec）を守ってください。

