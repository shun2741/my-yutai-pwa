# Repository Guidelines

## Project Structure & Module Organization
- Current state: minimal Node project with `package.json` and `node_modules/`.
- Recommended layout as the app grows:
  - `src/`: application code (feature folders, components, utils).
  - `public/`: static assets (icons, manifest, PWA assets).
  - `tests/` or `src/**/__tests__/`: unit/integration tests.
  - `scripts/`: local tooling and maintenance scripts.

## Communication & Language
- 既定言語: 日本語。
- Issue/PR のタイトル・説明・レビューコメントは日本語で記載してください。
- コードコメント・ドキュメントも日本語を基本とし、外部公開に適した箇所のみ英語可。
- コミットメッセージは基本的に日本語（件名・本文）で記載してください。Conventional Commits を使う場合は型/スコープのみ英語可。
  - 例: `feat(auth): ログインのリトライ制御を追加`

## Build, Test, and Development Commands
- Install deps: `npm install`
- Scripts are not defined yet. Add these as you introduce a framework/toolchain:
  - Dev server: `npm run dev` (e.g., Vite/Next).
  - Build: `npm run build` (produces production bundle).
  - Preview: `npm run preview` (serve built assets locally).
  - Test: `npm test` (runs unit tests; add `--watch` for TDD).

## Coding Style & Naming Conventions
- Indentation: 2 spaces; max line length 100.
- Filenames: kebab-case (`user-profile.ts`); React/Vue components: PascalCase.
- Variables/functions: camelCase; constants: UPPER_SNAKE_CASE.
- Prefer TypeScript for new code. Add types for external boundaries.
- Formatting: use Prettier; Linting: ESLint with sensible defaults.

## Testing Guidelines
- Framework: Jest or Vitest (pick one and standardize).
- Test locations: `tests/` or colocate in `__tests__/`.
- Naming: `*.test.ts` or `*.spec.ts` mirrors source path.
- Minimum coverage target: 80% lines/branches; focus on critical flows first.
- Run: `npm test` and `npm run test:coverage` (add scripts accordingly).

## Commit & Pull Request Guidelines
- コミットメッセージは日本語を基本とします。Conventional Commits を使う場合、型/スコープ（`feat:`, `fix:` 等）は英語でも可。件名・本文は日本語で記述してください。
  - 例: `feat(auth): リフレッシュトークンのフローを追加`
  - 例: `fix: ビルド時の型エラーを解消`
- コミットは小さく、リバータブルかつスコープ一貫で。Issue 参照: `Fixes #123` 等。
- PR: 目的・変更内容・影響範囲を明確に。UI 変更はスクリーンショット、テスト観点も記載。
- マージ条件: CI・Lint・テストの通過。

## Security & Configuration Tips
- Never commit secrets. Use `.env.local` for dev-only variables; document required keys in `.env.example`.
- Target Node 18+ for tooling compatibility.
- For PWA assets, keep `manifest.json` and icons in `public/` and validate Lighthouse.

## Agent-Specific Instructions
- Make minimal, focused patches; avoid unrelated changes.
- Prefer `rg` for search; keep changes within `src/`, `tests/`, and `public/`.
- Update this file if conventions or scripts change.
