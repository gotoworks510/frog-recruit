# frog-recruit

Frog が見極めた海外就職候補者を採用企業へ紹介する3者向け Web サービス（Cloudflare 完結）。

- **候補者**（招待制 / Google）: 採用に必要な情報だけのキュレーション済みプロフィールを作成
- **採用企業**（管理者発行のメール＋パスワード）: 紹介された候補者の**推薦ポイント／留意点**を閲覧。レジュメは閲覧者・日時の透かし＋監査ログ
- **管理者**（Frog スタッフ）: 候補者の審査・推薦編集・企業アカウント発行・閲覧権限の付与/失効

## スタック

Next.js 15 (App Router) + React 19 + TypeScript / `@opennextjs/cloudflare` / D1 (drizzle) / R2 / KV / Resend / NextAuth v5（Google + Credentials 混在 / JWT）。

## クイックスタート

```bash
cp .env.example .env.local   # 値を埋める（CLAUDE.md 参照）
npm install
npm run db:setup             # DEV D1 にスキーマ + Palm seed
npm run dev                  # http://localhost:3005
```

詳細・アーキテクチャ・デプロイ手順は **[CLAUDE.md](CLAUDE.md)**、動作確認は **[docs/SMOKE-TEST.md](docs/SMOKE-TEST.md)** を参照。

## ⚠️ 重要な前提

- `recruit.frogagent.com` は `frogagent.com` が **Cloudflare ゾーンであること**が前提（未確認。不可なら `recruit.frog-school.com` にフォールバック。`wrangler.toml` 参照）。
- メール送信元は当面 `recruit@japan.frogagent.com`（`frogagent.com` の Resend 認証完了まで）。
- レジュメは **PDF 限定**。
