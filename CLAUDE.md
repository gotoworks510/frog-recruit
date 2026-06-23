# frog-recruit — Claude Code Guide

Frog が見極めた**海外就職候補者**を採用企業へ紹介する3者向けWebサービス。Slack 投稿（Palm 社のシニア Backend Engineer 募集、USD $175k–190k）をきっかけに新設。**本番ドメイン `recruit.frog-school.com`**（2026-06-22 オーナー決定。frog-school.com は CF ゾーンのため全自動デプロイ可）、Cloudflare で完結。将来 `recruit.frogagent.com` への切替は Cloudflare for SaaS 経由で想定済（下記「ドメイン切替」）。

## このプロジェクトの性質

- **Next.js 15.5 (App Router) + React 19 + TypeScript 5**（frog-school-portal と同一スタックを踏襲）
- **Cloudflare Workers** via `@opennextjs/cloudflare` / **D1 (drizzle)** / **R2**（レジュメ）/ **KV**（ログインレート制限）/ **Resend**（メール）
- **NextAuth v5 + JWT セッション** — Google（候補者・管理者）＋ Credentials（採用企業）の**混在認証**
- **3ロール**: `admin`（Frogスタッフ）/ `candidate`（招待制・Google）/ `employer`（管理者発行のメール＋PBKDF2パスワード）
- dev ポート **3005**（`npm run dev`）。本番 `recruit.frog-school.com`。

## ⚠️ 着手前に確認すべき前提（重要）

1. **ドメインは `recruit.frog-school.com`** — frog-school.com は CF ゾーン active。`wrangler.toml` の `[[routes]] custom_domain=true` でデプロイ時に DNS+証明書が自動発行される。
2. **Resend 送信元** — `frogagent.com` は未認証。**当面 `recruit@japan.frogagent.com` から送信**（`RECRUIT_FROM_EMAIL` / `src/lib/email/resend.ts`）。
3. **レジュメは PDF 限定**（透かし経路統一のため。`src/lib/storage/magic-bytes.ts` で magic-byte 強制）。

## ドメイン切替（recruit.frog-school.com → recruit.frogagent.com）

frogagent.com は Netlify 管理で CF ゾーンではないため、Worker を当ホスト名で出すには **Cloudflare for SaaS** が必要（現状アカウントで 403=未有効）。切替手順:
1. frog-school.com ゾーンで Cloudflare for SaaS を有効化し、この Worker を **Fallback Origin** に設定（originless ダミー DNS `recruit-fallback AAAA 100::`、proxied）。
2. **Worker route `recruit.frogagent.com/*`** を frog-school.com ゾーンに API 追加（`*/*` は不可＝portal/mailsystem を巻き込む）。
3. **Custom Hostname `recruit.frogagent.com`** を作成 → 払い出される CNAME + TXT 検証レコードを **Netlify DNS(frogagent.com)** に追加。
4. `wrangler.toml` の `NEXTAUTH_URL` / `PUBLIC_BASE_URL` を `https://recruit.frogagent.com` に変更し、Google OAuth に当該リダイレクト URI を追加。**アプリのコード変更は不要**（ドメインは env から読む）。
- 参考: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/

## アーキテクチャの約束

- **認可は middleware ではなく各 page / route handler で実施**（`src/lib/auth/helpers.ts` のガード）。middleware はセキュリティヘッダ + 全面 noindex のみ。
- **データ変更は Server Actions**（`src/lib/{candidate,admin}/actions.ts`）。各アクションは冒頭で `requireCandidate()` / `requireAdmin()` 等を呼び**アクション内で認可**する。所有権チェック必須（experience/link は profile 一致を確認）。
- **招待制ゲート**: Google サインインは「ADMIN_EMAILS に一致 = admin」または「email 一致の有効な招待を持つ = candidate」のみ通す。**それ以外の Google サインインは拒否**（`src/lib/auth/auth.ts` の signIn）。招待は**招待先メールと Google アカウントの email が一致**する場合のみ有効。
- **employer 認証は users テーブルに統合**（`auth_provider='credentials'` + PBKDF2 `password_hash`/`password_salt`）。運用メタは `employer_accounts`。
- **推薦は会社別**（`recommendations.companyId`、null=汎用フォールバック）。候補者ごとに「紹介する会社」単位で推薦文を作成し、企業は自社向け推薦（無ければ汎用）を見る。`buildEmployerCandidateView(db, profileId, { companyId })` が会社一致→汎用の順で選択。admin の `/admin/candidates/[id]` は会社別カード＋会社セレクタ＋会社別プレビュー。
- **行レベル認可スパイン = `requireGrant`/`getEffectiveGrant`**（`src/lib/auth/grant.ts`）。企業の候補者参照は全て通す。**有効アクセス = grant 有効（未失効・未期限切れ）AND 候補者の consent 有効 AND grant の会社向け（または汎用）の published+shared recommendation が存在**。一覧は `listGrantedCandidateIds` で同条件に絞る。
- **PII 最小化**: 企業へ返すのは `src/lib/employer/candidate-dto.ts`（`buildEmployerCandidateView`）の DTO のみ。`internalNotesMd`・生メール等は**絶対に含めない**。recommendation は published+shared のみ。
- **レジュメ配信**: 企業向けは `(employer)/portal/candidates/[id]/resume/route.ts` のみ。`requireGrant` → `pdf-lib` で**企業名＋閲覧者＋日時の透かし**を毎回焼き込み → `view_audit` 追記 → ストリーム。durable URL は作らない。透かしは抑止でDRMではない。
- **監査 `view_audit` は追記専用**（`src/lib/audit/log.ts`）。削除経路なし。
- **🌐 言語ポリシー（2026-06-22 オーナー決定）**: ユーザーの大半が英語圏。**公開 / 候補者(`/me`) / 採用企業(`/portal`) 向け面・候補者/企業宛メール（`src/lib/email/messages.ts`）・`CandidateView`・`profile.ts` のラベルは英語**。**管理者(`/admin`) 専用ページと `src/lib/admin/actions.ts` は日本語のまま**。新規 UI 追加時もこの線引きを守る。`react/no-unescaped-entities` は eslint で off（英語のアポストロフィでビルドが落ちるため）。
- **⚠️ NextAuth は遅延設定（関数形）必須**（`src/lib/auth/auth.ts` の `NextAuth(() => ({...}))`）。OpenNext/Cloudflare では **Worker シークレット（`GOOGLE_CLIENT_SECRET`/`AUTH_SECRET`）は process.env にリクエスト時のみ注入**され、モジュール読込時は未定義。静的設定だと `Google({clientSecret: process.env...})` が undefined を掴み、**コールバックで `error=Configuration`（"There is a problem with the server configuration"）**になる。`[vars]`（`GOOGLE_CLIENT_ID` 等）はモジュール読込時から見えるので clientId だけ正しく出てしまい紛らわしい。関数形にして毎リクエスト読むことで解消（2026-06-22 修正）。

## 主要ファイル早見表

| 用途 | パス |
|---|---|
| 認証中核（Google+Credentials・招待制） | `src/lib/auth/auth.ts` |
| ガード（role/consent/forced-reset） | `src/lib/auth/helpers.ts`, `src/lib/employer/guard.ts` |
| **行レベル認可スパイン** | `src/lib/auth/grant.ts`（`getEffectiveGrant` / `listGrantedCandidateIds`） |
| 企業向け安全DTO | `src/lib/employer/candidate-dto.ts` |
| パスワード(PBKDF2)・レート制限 | `src/lib/auth/password.ts`, `src/lib/ratelimit/kv.ts` |
| レジュメ透かし | `src/lib/pdf/watermark.ts` |
| 監査 | `src/lib/audit/log.ts` |
| メール | `src/lib/email/{resend,templates,messages}.ts` |
| DB クライアント（dual-mode） | `src/lib/db/client.ts`, `src/lib/db/d1-http-proxy.ts` |
| スキーマ | `src/lib/db/schema/*`（barrel: `index.ts`） |
| ストレージ(R2) | `src/lib/storage/{r2,r2-s3-proxy,magic-bytes}.ts` |
| 候補者アクション | `src/lib/candidate/actions.ts` |
| 管理者アクション | `src/lib/admin/actions.ts` |
| Middleware（noindex/CSP） | `src/middleware.ts` |
| 手書きマイグレーション（正本） | `scripts/migrations/0001_init.sql` |
| シード（Palm 社＋求人） | `scripts/seed.sql` |
| ページ | `src/app/{(auth),(candidate),(employer),(admin)}/` |

## ルートグループ

- `(auth)` — 公開: `/login`(Google), `/employer/login`(メール+パス), `/invite/[token]`, `/consent`, `/pending`, `/rejected`
- `(candidate)` `requireCandidate` — `/me`, `/me/{profile,experience,links,resume,sharing,preview}`
- `(employer)` `requireEmployerReady` — `/portal`, `/portal/candidates/[id]`(+`/resume`), `/portal/account/password`
- `(admin)` `requireAdmin` — `/admin`, `/admin/{candidates,invites,companies,employers,grants,audit}`
- ルート `/` = 公開ブランドLP。`/api/auth/[...nextauth]`, `/api/profile/resume`(候補者の自己閲覧)。

## 開発コマンド

```powershell
npm run dev                 # port 3005
npm run db:setup            # ローカル D1 にスキーマ + seed（Palm）適用
npm run db:reset            # reset → setup
npm run db:schema:remote    # 本番 D1 にスキーマ適用
npm run db:seed:remote      # 本番 D1 に Palm seed
npm run build               # next build（検証用）
npm run deploy              # @opennextjs/cloudflare build → wrangler deploy
```

ローカル dev は `.env.local` が必要（`.env.example` 参照）。dual-mode クライアントは dev で **DEV/STAGING の D1（`DEV_D1_DATABASE_ID`）+ R2（S3プロキシ）** に HTTP 接続する。**本番 D1 を指すと安全ガードで停止**（`D1_ALLOW_PROD_IN_DEV=1` で明示 opt-in）。

## デプロイ状況（2026-06-22 デプロイ済 🟢）

本番: **https://recruit.frog-school.com**（CF Worker / OpenNext）。完了済:
- [x] CF リソース作成・wrangler.toml に ID 反映: D1 `frog-recruit-db`=`e4eeced9-5269-4cac-a979-21ccacaefc4d` / R2 `frog-recruit-files` / KV=`f68df58a2fd643c98ed36a0b00ec116e`
- [x] ドメイン: `recruit.frog-school.com`（`custom_domain=true` で DNS+証明書自動発行）
- [x] 本番 D1 マイグレ＋Palm seed（`scripts/migrations/0001_init.sql` / `scripts/seed.sql`）
- [x] Worker secrets: `AUTH_SECRET` / `NEXTAUTH_SECRET`（生成）/ `GOOGLE_CLIENT_SECRET` / `RESEND_API_KEY`
- [x] `[vars]` GOOGLE_CLIENT_ID / NEXTAUTH_URL / PUBLIC_BASE_URL / ADMIN_EMAILS / RECRUIT_FROM_EMAIL
- [x] スモーク（`/` 200・noindex・CSP・`/login` Google ボタン・`/robots.txt`）

**⚠️ 残オーナー作業（これが無いと Google ログイン不可）**:
- [ ] Google Cloud Console の OAuth クライアント（`1040291765049-…`）の「承認済みのリダイレクト URI」に
      `https://recruit.frog-school.com/api/auth/callback/google`（+ ローカル用 `http://localhost:3005/api/auth/callback/google`）を登録。
- [ ] 上記登録後、`senna@frogagent.com`（ADMIN_EMAILS）で `https://recruit.frog-school.com/login` から Google ログイン → `/admin` に入れることを確認。

**再デプロイ**: コード変更後は `frog-recruit` で `& .\node_modules\.bin\opennextjs-cloudflare.cmd build` → `& .\node_modules\.bin\wrangler.cmd deploy`（`npm run deploy` は `npx` 不調の環境があるためローカルバイナリ直叩き推奨。`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` は `../.env` から）。

## スモークテスト

`docs/SMOKE-TEST.md` 参照（admin Google ログイン → 候補者招待 → プロフィール作成 → 推薦公開&共有 → 企業アカウント発行 → 権限付与 → 企業ログイン → 透かしレジュメ → 失効で 403）。

## 既知の注意 / TODO

- 同意は v1 では `share_with_employers`（広域）を /consent で取得し `requireGrant` がこれを参照。`share_with_company`（企業別）もスキーマ対応済だが UI 未提供。法務方針が固まれば企業別へ。
- 透かしは抑止でありDRMではない（スクショ/印刷で破れる）。信頼企業向けパイロットとして許容・関係者へ明示。
- レジュメは PDF 限定（DOCX は透かし不可のため非対応）。
- recommendation は候補者あたり1件（general, `jobId` null）を upsert。求人別推薦は将来拡張。
- ルート CLAUDE.md ルール #5（社内ツールUI統一）: 本サービスは**一般ユーザー（候補者・企業）向け = 対象外**。Frog ブランドトークン（teal）で構築。admin 画面のみ将来 frog-admin-kit を着せてよい。
