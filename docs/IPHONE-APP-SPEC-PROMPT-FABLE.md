# Frog Recruit iOS アプリ — 設計・仕様・ビルドプロンプト

> 作成: 2026-09-16 / 対象: Web版 `recruit.frogagent.com`（frog-recruit, Next.js 15 + Cloudflare Workers + D1）をベースにした **iPhone アプリ 2 本**（企業向け / 候補者向け）と、それを支える **モバイルAPI + Push 通知基盤**。
> この文書は「仕様書」であると同時に、Claude Code / エージェントへそのまま渡せる **マスタープロンプト** として書かれている。§14 に各フェーズの起動プロンプトを置く。
>
> **⚠️ オーナー確定の上書き:** `docs/IPHONE-APP-OWNER-DECISIONS.md` が本文書と矛盾する場合は **OWNER-DECISIONS が優先**（候補者返答3値、企業Home構成、閲覧Push既定OFF、セルフサービス認証、consent撤回時Home、refresh/オフライン安全性など）。
>
> **⚠️ オーナー確定の上書き:** `docs/IPHONE-APP-OWNER-DECISIONS.md` が本文書と矛盾する場合は **OWNER-DECISIONS が優先**（候補者返答3値、企業Home構成、閲覧Push既定OFF、セルフサービス認証、consent撤回時Home、refresh/オフライン安全性など）。

---

## 0. この文書の使い方

- 実装者（人間・エージェント問わず）は **必ず全文を読んでから** 着手する。既存 Web 版の約束事（`frog-recruit/AGENTS.md`）は全てモバイルにも適用される。
- 「**推奨（既定）**」と書かれた意思決定はオーナー未確認の既定値。反対がなければそのまま実装する。変更する場合は §3 の該当行を書き換えてから着手する。
- フェーズは §13 の順に進める。**Phase 0（バックエンド API + 通知基盤）が完了しない限りアプリ実装に入らない**。
- 英語/日本語の線引きは Web 版と同じ: **アプリ内 UI 文字列・Push 文言・API エラーは英語のみ**。この文書とコード内コメント・管理画面は日本語可。

---

## 1. ゴールと非ゴール

### ゴール
1. **企業（employer）向け iPhone アプリ** — Frog から紹介された候補者を **Tinder 風のカードデッキ** で確認し、右スワイプ=Interested / 左=Not interested / 上=Maybe で即フィードバック。透かし付きレジュメをアプリ内で閲覧。**新しい候補者が紹介されたら Push 通知**。
2. **候補者（candidate）向け iPhone アプリ** — 自分のプロフィール/職歴/リンク/レジュメの編集、Frog による紹介先企業と進捗の確認。**企業からのアクション（Interested・プロフィール閲覧）や Frog による紹介ステータス更新があったら Push 通知**。
3. Web 版と **同一の認可スパイン・同一の PII 最小化・同一の監査** を通す。モバイル専用の抜け道を作らない。
4. 通知は **アプリ内 Inbox（既読管理）+ Push + 既存メール** の三層。ユーザーが種類ごとに Push を ON/OFF できる。

### 非ゴール（v1 では作らない）
- 管理者（Frog スタッフ）機能のモバイル化（管理は Web `/admin` のまま）。
- Android 版（設計上は排除しないが、v1 は iOS のみ。React Native 採用で将来展開可）。
- 候補者と企業の **直接チャット / 直接連絡**。Frog が仲介する原則は不変。
- DRM。透かしは抑止であり、スクリーンショットは防げない（Web 版と同じ明示）。
- Google / Apple サインイン（§3-D 参照。credentials のみ）。

---

## 2. 既存 Web 版の前提（実装者が信頼してよい事実）

コードを読んで確認済みの事実。モバイルはこれらを **再利用** し、複製しない。

| 領域 | 事実 | 参照 |
|---|---|---|
| ロール | `users.role ∈ {admin, candidate, employer}`。employer は `users.employerCompanyId` + `employer_accounts`（mustResetPassword / disabledAt）。candidate credentials は `candidate_accounts`（同構造） | `src/lib/db/schema/{auth,employers,candidate-accounts}.ts` |
| 認証 | NextAuth v5 JWT（Cookie）。Credentials provider は email + PBKDF2（`verifyPassword`）。KV による IP レート制限 `loginRateLimit(ip)` | `src/lib/auth/auth.ts`, `src/lib/auth/password.ts`, `src/lib/ratelimit/kv.ts` |
| ゲート | employer: disabled → login / mustReset → `/portal/account/password` / terms 未同意 → `/legal`。candidate: 同様 + consent 未取得 → `/consent` | `src/lib/employer/guard.ts`, `src/lib/candidate/guard.ts`, `src/lib/auth/helpers.ts` |
| 行レベル認可 | `getEffectiveGrant(db, employerUserId, profileId)` = grant 有効 AND consent 有効 AND その会社向け（または汎用）の published+shared recommendation 存在。一覧は `listGrantedCandidateIds` | `src/lib/auth/grant.ts` |
| 企業向け DTO | `buildEmployerCandidateView(db, profileId, { companyId })`。`internalNotesMd`・生メールは含まない。`frogScore` は企業向けのみ | `src/lib/employer/candidate-dto.ts` |
| フィードバック | `candidate_feedback`（employer×candidate で upsert）。`interest ∈ {interested, maybe, not_interested}` / `wantsInterview` / `questionsMd` / `declineReasons[]` / `declineNote`。**interested に初めてなった時のみ** 候補者へメール + Frog Slack | `src/lib/employer/feedback-actions.ts`, `src/lib/employer/feedback.ts` |
| レジュメ | PDF 限定（magic bytes）。企業向け配信は毎回 `pdf-lib` で「会社名＋閲覧者＋日時」透かし → `view_audit(download_resume)` → ストリーム。durable URL なし | `(employer)/portal/candidates/[id]/resume/route.ts`, `src/lib/pdf/watermark.ts` |
| 監査 | `view_audit` 追記専用。`action ∈ {view_list, view_detail, view_resume, download_resume, preview_pdf, submit_feedback}` | `src/lib/audit/log.ts` |
| 紹介パイプライン | `candidate_introductions`（candidate×company）。`status ∈ {planned, shared, interviewing, offer, hired, declined, withdrawn}`。`statusNote` は候補者に見せてよい、`noteInternal` は絶対に出さない。grant 作成時に `ensureIntroduction(status: "shared")` が自動作成 | `src/lib/db/schema/introductions.ts`, `src/lib/admin/actions.ts` |
| 同意 | v1 は `share_with_employers`（広域）。候補者は `/me/sharing` で revoke / enable 可能。revoke すると全企業から即時不可視 | `src/lib/candidate/actions.ts` |
| 既存の外部通知 | Resend メール（共通 HTML シェル強制、`sendEmail({subject, subtitle, bodyHtml})`）と Slack（`notifySlack`）。Push は未実装 | `src/lib/email/*`, `src/lib/slack/notify.ts` |
| インフラ | CF Worker（OpenNext）/ D1 `frog-recruit-db` / R2 `frog-recruit-files` / KV。`wrangler.toml` に routes。dev は port 3005 | `wrangler.toml` |
| デザイン | brand `#0f3024` / frog `#2a5a45` / mint `#dceee4` / mint-deep `#c5e0d2` / surface `#f7f5ed` / surface-2 `#efece3` / ink `#1a2420` / muted `#6b756f` / line `#ddd9cf` / danger `#e2543b`。本文 Inter、見出し Source Serif | `src/app/globals.css` |
| デモデータ | 架空企業 Harborline Analytics + 架空候補者（Alex Rivera 等）。App Review 用アカウントに流用可 | `src/lib/demo/mock-data.ts` |

---

## 3. 意思決定（推奨既定値）

| # | 論点 | 決定（推奨・既定） | 理由 / 代替 |
|---|---|---|---|
| A | クロスプラットフォーム基盤 | **React Native (Expo, TypeScript, expo-router, New Architecture)**。SDK は実装時点の最新安定版 | Web と同じ TS で zod 契約を共有できる・EAS Update で審査なしの JS 修正が可能・1 人＋AI 体制で 2 アプリを保守できる。代替 SwiftUI はジェスチャの手触りは最良だが型共有と OTA を失う |
| B | アプリ本数 | **2 本の App Store 掲載**（`Frog Recruit`＝候補者 / `Frog Recruit for Employers`＝企業）。**1 つのモノレポ**で `apps/candidate` `apps/employer` + 共通 `packages/*` | Uber / Uber Driver 型。B2C と B2B で審査メモ・スクショ・Push カテゴリが違う。ログイン時のロール混同を構造的に排除。コードは 7 割共有 |
| C | リポジトリ | **新規 private リポ `gotoworks510/frog-recruit-mobile`**。API 契約（zod）は Web リポ `frog-recruit/src/lib/api/v1/contracts/` を正本とし、`npm run sync:contracts` で mobile 側 `packages/api/contracts/` へコピー | frog-recruit は public。Expo と Next.js を 1 workspace に同居させると依存のホイストで壊れやすい |
| D | モバイル認証方式 | **credentials（email + password）のみ**。既存 Google 招待候補者は管理画面の `createCandidateAccount / rotateCandidatePassword` で credentials を発行して移行 | Google サインインを載せると App Store 4.8 で Sign in with Apple 併設が必須になり、Apple の Hide My Email が招待メール一致ゲートを壊す。管理者発行アカウントのみなら 4.8 の適用外 |
| E | トークン | **自前 Bearer JWT**（access 15 分, HS256, 新シークレット `MOBILE_JWT_SECRET`）+ **回転式 refresh トークン**（不透明, 30 日, D1 `mobile_sessions` にハッシュ保存, 再利用検知で失効） | NextAuth Cookie セッションはネイティブから扱いづらい。JWT ペイロードは `sub/role/companyId/sid/appVariant` のみ |
| F | Push 配送 | **Expo Push Service**（`exp.host/--/api/v2/push/send`）経由。サーバ側は `sendPush()` 抽象の裏に閉じ込め、将来 APNs 直叩き（p8 + WebCrypto ES256）へ差し替え可能にする | APNs トークン管理・HTTP/2 接続・失効処理を Expo に委譲。件数は当面数百/日以下 |
| G | 非同期実行 | `getCloudflareContext().ctx.waitUntil()` でリクエスト後に Push を送る。Cloudflare Queues は使わない | Queues は有料プラン前提。v1 の件数なら waitUntil で十分。失敗は `notifications.push_status` に記録 |
| H | 候補者側の「スワイプ」 | **紹介カードへの反応**（`I'm interested` / `Talk to Frog first`）を **v1 に含める**。反応は `candidate_introductions.candidate_response` に保存し、Frog へ Slack 通知。企業へは **直接通知しない**（Frog が仲介） | Tinder 感を候補者側にも与える最小機能。⚠️ オーナー確認事項: 反対なら Phase 2 から外す |
| I | 「プロフィールを閲覧された」通知 | **既定 ON**（企業名のみ、閲覧者個人名は出さない、同一企業×同一日で 1 回に集約）。ユーザーが OFF 可能 | LinkedIn 型のエンゲージメント。`not_interested` / `maybe` は **絶対に候補者へ通知しない** |
| J | ダークモード | v1 は **ライト固定**（`userInterfaceStyle: "light"`） | スコープ抑制。トークン設計はダーク対応可能な形にしておく |
| K | クラッシュ計測 | Sentry（`sendDefaultPii: false`, breadcrumbs から URL クエリ・本文を除去）。プロダクト分析 SDK は入れない | PII 最小化 |
| L | 生体認証ロック | v1.1（Phase 3） | まず審査通過を優先 |
| M | Universal Links | v1.1（Phase 3）。`/.well-known/apple-app-site-association` を Worker から配信 | メールのリンクからアプリ起動 |

---

## 4. 全体アーキテクチャ

```
┌──────────────────────────┐        ┌──────────────────────────┐
│  Frog Recruit (candidate)│        │ Frog Recruit for Employers│
│  iOS · Expo RN           │        │ iOS · Expo RN             │
│  bundle com.frogagent.   │        │ bundle com.frogagent.     │
│    recruit               │        │    recruit.employer       │
└─────────────┬────────────┘        └─────────────┬────────────┘
              │ HTTPS Bearer JWT (access 15m / refresh 30d)      │
              ▼                                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  recruit.frogagent.com — 既存 CF Worker (OpenNext / Next.js 15)  │
│  追加: /api/v1/**  (route handlers, Bearer 認証)                 │
│  再利用: getEffectiveGrant / buildEmployerCandidateView /        │
│          watermarkPdf / writeAudit / sendEmail / notifySlack      │
│  追加: src/lib/notify/{events,deliver,push,prefs}.ts             │
│        src/lib/api/v1/{auth,contracts,errors}.ts                 │
└───────┬──────────────┬──────────────┬──────────────┬────────────┘
        │ D1           │ R2           │ KV           │ waitUntil
        ▼              ▼              ▼              ▼
  既存テーブル      レジュメPDF     rate-limit    Expo Push API ──▶ APNs ──▶ 端末
  + mobile_sessions                                 Resend (既存メール)
  + device_push_tokens                              Slack  (既存 ops 通知)
  + notifications
  + notification_preferences
```

原則:
- **モバイルは既存 Worker の API クライアントに過ぎない**。ビジネスロジックは Web と共通のコア関数に集約し、Server Action と API handler の両方から呼ぶ（§6.0 のリファクタ）。
- **Web 版の挙動は一切変えない**（デグレ禁止）。リファクタは「抽出」のみ。
- 管理画面からの操作（grant 作成・推薦公開・紹介ステータス更新・パスワード回転・無効化）が **モバイル側のイベント源**。管理 Server Action に `emit()` / `revokeMobileSessions()` を追記する。

---

## 5. データモデル追加（`scripts/migrations/0009_mobile.sql` + drizzle schema）

新規テーブルのみ。既存テーブル変更は `candidate_introductions` への 2 列追加と `users.is_test` のみ。

```sql
-- モバイルのリフレッシュトークン（1 行 = 1 端末セッション）
CREATE TABLE mobile_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_variant TEXT NOT NULL CHECK (app_variant IN ('candidate','employer')),
  device_id TEXT NOT NULL,            -- アプリ初回起動時に生成し SecureStore 保存
  device_name TEXT,                   -- "Senna's iPhone"
  app_version TEXT,
  refresh_token_hash TEXT NOT NULL UNIQUE,  -- SHA-256(opaque token)
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revoked_reason TEXT                 -- logout / rotated / reuse_detected / password_changed / admin
);
CREATE INDEX idx_msess_user ON mobile_sessions(user_id);

-- Push トークン（Expo push token）
CREATE TABLE device_push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_variant TEXT NOT NULL,
  device_id TEXT NOT NULL,
  expo_push_token TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  invalidated_at INTEGER,             -- DeviceNotRegistered 受領時
  last_error TEXT
);
CREATE UNIQUE INDEX uq_push_user_device ON device_push_tokens(user_id, device_id);

-- アプリ内 Inbox（Push の有無に関わらず必ず 1 行作る）
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- §7.1 のイベント種別
  title TEXT NOT NULL,                -- 英語
  body TEXT,                          -- 英語
  data_json TEXT,                     -- deep link 用 {"route":"...","id":"..."}
  dedupe_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  pushed_at INTEGER,
  push_status TEXT                    -- skipped_pref / skipped_no_device / sent / error
);
CREATE UNIQUE INDEX uq_notif_user_dedupe ON notifications(user_id, dedupe_key);
CREATE INDEX idx_notif_user_created ON notifications(user_id, created_at DESC);

-- 種類別 Push 設定（行が無ければ既定 ON）
CREATE TABLE notification_preferences (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind)
);

-- 候補者の紹介カードへの反応（§3-H）
ALTER TABLE candidate_introductions ADD COLUMN candidate_response TEXT
  CHECK (candidate_response IN ('interested','talk_to_frog'));
ALTER TABLE candidate_introductions ADD COLUMN candidate_responded_at INTEGER;

-- App Review / 内部検証アカウント。メール・Slack をスキップし、Push のみ実配信
ALTER TABLE users ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;
```

drizzle: `src/lib/db/schema/mobile.ts`（4 テーブル）を追加し `index.ts` の barrel に載せる。`introductions.ts` と `auth.ts` に列追加。

---

## 6. モバイル API v1

### 6.0 先行リファクタ（Web 挙動不変）
Server Action に埋まっているコアを純関数へ抽出し、Action と API の双方から呼ぶ。

| 抽出先 | 抽出元 | 内容 |
|---|---|---|
| `src/lib/employer/feedback-core.ts` `upsertCandidateFeedback(db, {employerUserId, grant, input, audit})` | `feedback-actions.ts saveCandidateFeedback` | バリデーション・upsert・`newlyInterested` 判定・候補者メール・Slack・`submit_feedback` 監査。**戻り値に `newlyInterested` を含め、呼び出し側が `emit("employer.interested")` する** |
| `src/lib/employer/resume-stream.ts` `buildWatermarkedResume(db, {employerUserId, companyId, viewerEmail, profileId, audit})` | `portal/candidates/[id]/resume/route.ts` | grant 検査・R2 取得・透かし・監査。`Response` を返す |
| `src/lib/candidate/profile-core.ts` | `candidate/actions.ts` の各 Action | `updateProfile / addExperience / deleteExperience / addLink / deleteLink / uploadResume / removeResume / enableConsent / revokeConsent / requestLinkedInRefresh` の本体を `(db, userId, input)` 関数に |
| `src/lib/account/password-core.ts` | `(candidate)/me/account/password`, `(employer)/portal/account/password` の Action | 現行パス検証 → PBKDF2 更新 → `mustResetPassword=false` → **`revokeMobileSessions(userId, "password_changed", {exceptSessionId})`** |
| `src/lib/legal/accept-core.ts` | `/legal` の Action | `termsAcceptedAt / termsVersion` 更新 |

### 6.1 共通規約
- ベース: `https://recruit.frogagent.com/api/v1`。全て JSON（レジュメのみ `application/pdf`）。
- 認証: `Authorization: Bearer <accessToken>`。ヘルパー `requireMobile(request, { role: "employer" | "candidate" })` が JWT 検証 → `users` 再読込（role / status / disabled / mustReset / terms / consent を **毎回 DB で確認**、JWT のクレームを信用しない）→ `{ user, session }` を返す。
- **appVariant とロールの一致を強制**: employer アプリからのトークンで candidate エンドポイントは 403。
- ゲート未達で mutation → `409 { error: "gate_required", gate: "password_reset" | "terms" | "consent" }`。読み取り系（`/me`, `/legal/*`, `/account/*`）はゲート未達でも通す。
- エラー形式: `{ error: string, message: string }`（英語）。401 は本文を一様化（列挙防止）。
- レート制限（KV）: `/auth/login` は既存 `loginRateLimit(ip)` + `email` 単位 10 回/15 分。`/auth/refresh` 60 回/時/ユーザー。書き込み系 120 回/分/ユーザー。
- 監査: 企業の読み取りは Web と同じ `view_audit` を書く。`userAgent` にはアプリが送る `User-Agent: FrogRecruit-Employer/1.2.0 (iOS 19.1; iPhone16,2)` をそのまま記録。
- クエリの `cursor` は `created_at|id` の base64。`limit` 上限 50。
- 全レスポンスに `Cache-Control: no-store`。

### 6.2 エンドポイント一覧

**Meta / Auth（両アプリ）**

| Method & Path | 概要 |
|---|---|
| `GET /meta` | `{ minAppVersion: { candidate, employer }, maintenance: { active, message } }`。起動時に確認し、未満なら強制アップデート画面 |
| `POST /auth/login` | body `{ email, password, appVariant, device: { id, name, appVersion } }` → `{ accessToken, refreshToken, expiresIn, user, gates }`。ロール不一致は `403 wrong_app`（"This account is for the Frog Recruit candidate app."） |
| `POST /auth/refresh` | body `{ refreshToken }` → 新 access + **新 refresh**（旧はハッシュ失効）。失効済み refresh の再提示 = 再利用検知 → 同 user の全セッション失効 + Slack 警告 |
| `POST /auth/logout` | 自セッション失効 + 同 device の push token 削除 |
| `GET /me` | `{ user: { id, name, email, role }, company?: { id, name }, gates: { mustResetPassword, termsAccepted, consentActive, disabled }, unreadNotifications }` |
| `POST /account/password` | `{ currentPassword, newPassword }`。mustReset 時は currentPassword = 仮パスワード |
| `POST /account/terms/accept` | `{ version }` |
| `GET /legal/terms` `GET /legal/privacy` | `{ version, html }`（Web と同一文面。アプリは WebView で表示） |

**Notifications / Devices（両アプリ）**

| Method & Path | 概要 |
|---|---|
| `PUT /devices/push-token` | `{ deviceId, expoPushToken, enabled }`（upsert） |
| `DELETE /devices/push-token` | `{ deviceId }` |
| `GET /notifications?cursor&limit` | Inbox 一覧（新しい順） |
| `POST /notifications/read` | `{ ids: string[] } \| { all: true }` |
| `GET /notifications/preferences` | `[{ kind, label, description, pushEnabled }]`（ロールに該当する kind のみ） |
| `PUT /notifications/preferences` | `{ kind, pushEnabled }` |

**Employer（`role=employer`、ゲート: mustReset / terms）**

| Method & Path | 概要 |
|---|---|
| `GET /employer/company` | `{ id, name, contactName, fees: { tiers, calculationPoints, scopePoints } }`（`fee-schedule.ts` をそのまま JSON 化） |
| `GET /employer/candidates?bucket=new\|interested\|maybe\|passed` | `listGrantedCandidateIds` → 一覧カード。各要素 `{ profileId, headline, yearsExperience, workAuthLabel, locationPreference, frogScore, recommendationExcerpt, introducedAt, introductionStatus, myFeedback: { interest, wantsInterview, updatedAt } \| null, hasResume }`。**`displayName` は一覧でも返してよい**（Web 一覧と同じ）。`bucket=new` は `myFeedback == null`。`view_list` 監査 |
| `GET /employer/candidates/:id` | `buildEmployerCandidateView(db, id, { companyId })` + `myFeedback` + `introductionStatus`。`view_detail` 監査 → **`emit("employer.viewed")`** |
| `PUT /employer/candidates/:id/feedback` | `{ interest, wantsInterview?, questionsMd?, declineReasons?, declineNote? }` → `upsertCandidateFeedback` → `{ feedback, newlyInterested }` |
| `GET /employer/candidates/:id/resume` | `buildWatermarkedResume` → PDF ストリーム（`download_resume` 監査）。`canDownloadResume=false` は 403 |

**Candidate（`role=candidate`、ゲート: mustReset / terms / consent。consent 関連は consent ゲート免除）**

| Method & Path | 概要 |
|---|---|
| `GET /candidate/home` | `{ profile: { displayName, headline, completeness, hasResume }, consentActive, introductions: [{ id, company: { id, name, blurb, websiteUrl, logoUrl? }, status, statusNote, jobs: [{ title, location }], candidateResponse, updatedAt }] }`。`noteInternal` は絶対に含めない |
| `GET /candidate/profile` / `PATCH /candidate/profile` | `candidate_profiles` の編集可能フィールド（Web `updateProfile` と同一項目・同一 zod 検証） |
| `GET/POST /candidate/experiences`, `PATCH/DELETE /candidate/experiences/:id` | 所有権チェック必須 |
| `GET/POST /candidate/links`, `DELETE /candidate/links/:id` | 同上 |
| `POST /candidate/resume` | multipart `file`（PDF、既存 `uploadResume` と同じ magic-bytes・サイズ上限）→ R2 → **`emit("candidate.resume_updated")`**（Phase 3） |
| `GET /candidate/resume` | 自分のレジュメ（透かし無し。Web `/api/profile/resume` 相当） |
| `DELETE /candidate/resume` | |
| `GET /candidate/preview` | 企業が見る形（`buildEmployerCandidateView` から **`recommendation` を除いた** もの） |
| `POST /candidate/consent` | `{ action: "enable" \| "revoke", consentTextVersion }`。enable 後は **`syncCandidateVisibility()`**（§7.2） |
| `POST /candidate/introductions/:id/response` | `{ response: "interested" \| "talk_to_frog" }` → 保存 + Slack（Frog へ）。企業へは通知しない |
| `POST /candidate/linkedin-refresh` | `{ url }`（既存 `requestLinkedInRefresh` コア。レート制限 3 回/時） |
| `POST /candidate/account/deletion-request` | Slack へ「削除依頼」→ Frog が手動対応。アプリはローカルセッションを消す。App Store 5.1.1(v) 対応 |

### 6.3 契約（zod）の置き場所
- `src/lib/api/v1/contracts/{auth,common,employer,candidate,notifications}.ts` に **リクエスト/レスポンスの zod スキーマと型** を定義。handler は必ず `parse` してから処理。
- mobile リポの `packages/api` はこのディレクトリをコピーして `fetch` クライアント（`createApiClient({ baseUrl, getToken, onUnauthorized })`）を生成。API を変えたら **Web リポで契約を変更 → sync → mobile を追従** の一方向。

---

## 7. 通知システム

### 7.1 イベントカタログ（正本）

`src/lib/notify/events.ts` に `NotificationKind` の union と、各 kind の `{ audience, defaultPushEnabled, label, description }` を定義する。**Push 本文に候補者の氏名・報酬・Frog Score・内部メモを絶対に含めない**（ロック画面に出るため）。

| kind | 受信者 | トリガー箇所 | dedupe_key | Push title / body（英語） | deep link | 既定 | Phase |
|---|---|---|---|---|---|---|---|
| `candidate.introduced` | employer | `syncCandidateVisibility(profileId)`（§7.2）。`createGrant` / `saveRecommendation`(published+shared 化) / `enableConsent` の後 | `candidate.introduced:{grantId}:{grantedAt}` | "New candidate introduced" / "{headline} · {years} yrs · {workAuthLabel}" | employer `candidates/{profileId}` | ON | 1 |
| `introduction.updated` | employer | `upsertIntroduction` で status が `interviewing/offer/hired/withdrawn` に変化 | `introduction.updated:{introId}:{status}` | "Update from Frog" / "An introduction to your team moved to {statusLabel}." | employer `candidates/{profileId}` | ON | 1 |
| `candidate.resume_updated` | employer（effective grant あり かつ myFeedback ∈ {interested, maybe} または未評価） | `uploadResume` コア | `candidate.resume_updated:{profileId}:{resumeUploadedAt}` | "Candidate updated their resume" / "{headline}" | employer `candidates/{profileId}` | ON | 3 |
| `grant.expiring` | employer | Cron（3 日前） | `grant.expiring:{grantId}` | "Access expiring soon" / "Your access to a candidate ends in 3 days." | employer `candidates/{profileId}` | ON | 3 |
| `employer.interested` | candidate | `upsertCandidateFeedback` の `newlyInterested` | `employer.interested:{companyId}:{feedbackUpdatedAt}` | "{Company} is interested in connecting" / "Frog will reach out to you about next steps." | candidate `introductions/{introId}` | ON | 2 |
| `employer.viewed` | candidate | `view_detail` 監査（Web / mobile 両方）。employer ロールのみ、admin view-as は除外 | `employer.viewed:{companyId}:{YYYY-MM-DD}` | "{Company} viewed your profile" / "Your introduction is being reviewed." | candidate `introductions/{introId}` | ON（§3-I） | 2 |
| `introduction.created` | candidate | `ensureIntroduction` / `upsertIntroduction` で新規 or 初めて `shared` | `introduction.created:{introId}` | "Frog is introducing you to {Company}" / "See who they are and the role Frog connected you to." | candidate `introductions/{introId}` | ON | 2 |
| `introduction.updated` | candidate | `upsertIntroduction` で status 変化（`planned→shared` は上の kind に吸収） | `introduction.updated:{introId}:{status}:{updatedAt}` | 前向き（interviewing/offer/hired）: "Good news from Frog about {Company}" / "{statusNote or 'Your introduction moved to ' + label}". 中立（declined/withdrawn）: "Update on your introduction to {Company}" / "{statusNote or 'Your Frog representative will follow up.'}" | candidate `introductions/{introId}` | ON | 2 |
| `frog.message` | 両方 | 管理画面から個別メッセージ（新 admin UI） | `frog.message:{messageId}` | "Message from Frog" / 先頭 80 字 | Inbox | ON | 3 |

**絶対に通知しないもの**: 候補者への `not_interested` / `maybe`、`frogScore`、`internalNotesMd` / `noteInternal`、企業への候補者反応（§3-H）、admin view-as による閲覧。

### 7.2 可視化の同期 `syncCandidateVisibility(db, profileId)`
「新しい候補者が現れた」＝**そのロールにとって effective access が真になった瞬間**。grant 作成だけでなく、推薦の公開や同意の再有効化でも成立するため、単一のヘルパーに集約する。

```
for grant in active grants of profileId:
  if getEffectiveGrant(db, grant.employerUserId, profileId):
     emit(db, { kind: "candidate.introduced", userId: grant.employerUserId,
                dedupeKey: `candidate.introduced:${grant.id}:${grant.grantedAt.getTime()}`, ... })
```
`emit` は dedupe_key の UNIQUE で冪等なので何度呼んでも二重通知しない。呼び出し箇所: `createGrant`, `saveRecommendation`（保存後の状態が published+shared のとき）, `enableConsent` コア。

### 7.3 配送 `src/lib/notify/deliver.ts`
```
emit(db, event):
  1. users.is_test の場合も Inbox/Push は通常通り（メール/Slack は各コアが is_test を見てスキップ）
  2. INSERT notifications ... ON CONFLICT (user_id, dedupe_key) DO NOTHING → 挿入されなければ終了
  3. notification_preferences で push_enabled=0 なら push_status='skipped_pref' で終了
  4. device_push_tokens (enabled=1, invalidated_at IS NULL) を取得。無ければ 'skipped_no_device'
  5. ctx.waitUntil(sendExpoPush(tokens, { title, body, data, badge: unreadCount, sound: 'default',
                                        categoryId: kind, mutableContent: false }))
  6. ticket の DeviceNotRegistered → invalidated_at を打つ。その他エラーは last_error
```
- `badge` は未読件数（`read_at IS NULL` の COUNT）。既読 API 呼び出し時にアプリ側でも `setBadgeCount` する。
- Push には **`data.route` と `data.id` のみ** 載せ、詳細はアプリが API から取得する（ペイロード最小化）。
- Expo Push のレシート照合（`getReceipts`）は Phase 3 で Cron 実装。v1 はチケット時点のエラーのみ処理。

### 7.4 メールとの関係
既存メール（Interested → 候補者メール、招待・認証情報メール）は **そのまま維持**。Push は追加レイヤー。将来「Push が届いた人にはメールを間引く」最適化をするなら `notifications.pushed_at` を見て判断できるように設計しておく（v1 では実装しない）。

### 7.5 セッション失効の伝播 `revokeMobileSessions(db, userId, reason, { exceptSessionId? })`
呼び出し必須箇所: `rotateEmployerPassword`, `setEmployerDisabled(true)`, `deleteEmployer`, `rotateCandidatePassword`, `setCandidateDisabled(true)`, `setCandidateStatus(rejected)`, 本人のパスワード変更（他端末のみ）。同時に `device_push_tokens` も削除（退職者の端末に候補者情報の Push が飛ばないようにする）。

---

## 8. 企業アプリ仕様 — `Frog Recruit for Employers`

### 8.1 ナビゲーション
タブ 4 つ: **Discover**（デッキ）/ **Candidates**（一覧）/ **Inbox** / **Account**。Discover が初期タブ。

### 8.2 オンボーディングとゲート
`Login → (mustResetPassword → Set a new password) → (terms → Terms of Use & Privacy Policy) → Push 事前説明画面（"Get notified when Frog introduces a new candidate"）→ OS 許可ダイアログ → Discover`。
Push 許可は **初回デッキ表示の後** に出す（拒否率を下げる）。拒否されたら Account に「Notifications are off — Open Settings」導線。

### 8.3 Discover（カードデッキ）
- 対象: `bucket=new`（未評価）を **紹介が新しい順**。上限 20 枚をプリフェッチ、残 5 枚で次ページ。
- カード（1 枚 = 1 候補者）:
  ```
  ┌────────────────────────────────┐
  │ ● NEW · Introduced Sep 14      │
  │ Frog Score  8.5 / 10           │  ← FrogScoreBadge 相当
  │                                │
  │ Senior Backend Engineer        │  ← headline（Source Serif, 大）
  │ 8 yrs · IEC (Canada)           │
  │ Vancouver / remote             │
  │ ───────────────────────────    │
  │ WHY FROG RECOMMENDS            │
  │ • strengths 1 行目             │
  │ • strengths 2 行目             │
  │ ───────────────────────────    │
  │ Tap to see full profile ↗      │
  └────────────────────────────────┘
        ✕ Pass      ? Maybe      ♥ Interested
  ```
  氏名はカード表面には出さない（一覧・詳細では表示）。ロック画面同様「まず職能で判断」の思想と、肩越しの覗き見対策。
- ジェスチャ（`react-native-gesture-handler` + `reanimated`）: 右 = Interested / 左 = Not interested / 上 = Maybe。閾値 = 画面幅 30% または速度。ドラッグ中にカード上へ "INTERESTED" / "PASS" / "MAYBE" のスタンプをフェード表示。ボタン 3 つはジェスチャと等価。Haptics（`impactMedium` で確定、`notificationSuccess` で Interested）。
- 確定フロー:
  - **Interested** → ボトムシート "Would you like to interview?"（toggle）+ "Questions for Frog (optional)" + [Send to Frog]。送信後にカードが飛ぶ。シート内に Web と同じ注意文「A Frog representative will contact you about next steps. You don't need to email the candidate yourself.」
  - **Not interested** → ボトムシート: `DECLINE_REASONS` のチップ（複数選択）+ note（任意）+ [Send] / [Send without reasons]。
  - **Maybe** → 即時。
  - いずれも **3 秒の Undo トースト**の後に `PUT /feedback` を発火（Gmail 型）。Undo でカードが戻る。サーバ側に DELETE は作らない。
- カードタップ → 詳細（§8.5）をモーダルで開く。詳細からも同じ 3 アクション。
- 空状態: 「You're all caught up. Frog is sourcing — we'll notify you the moment a new candidate is introduced.」+ Candidates タブへの導線。
- オフライン時: キューに積み、復帰後に順次送信（`PUT` は冪等）。

### 8.4 Candidates（一覧）
セグメント: **New / Interested / Maybe / Passed**。行 = 氏名・headline・years・work auth・Frog Score・最終評価日。Passed からも再評価可能（upsert）。プルリフレッシュ。

### 8.5 候補者詳細
Web `CandidateView` と同じ順序・同じ項目: ヘッダー（氏名・headline・Frog Score）→ 概要（location / preference / years / work auth / visa notes / availability / English / desired salary）→ Frog's recommendation（Strengths / Considerations, Markdown）→ Summary → Experience（タイムライン）→ Links（外部ブラウザ）→ Resume ボタン。
- **Resume**: `GET /employer/candidates/:id/resume` を Bearer 付きでファイルキャッシュ（アプリのサンドボックス、`no-store` 相当で閉じたら削除）→ アプリ内 PDF ビューア。**共有シートを出さない・Files 保存ボタンを置かない**。画面上部に常時バナー「Confidential · Watermarked for {Company}」。`canDownloadResume=false` の場合はボタン自体を出さず「Resume available on request via Frog」。
- 下部固定に「Your feedback」バー（現在の評価 + 変更ボタン）。

### 8.6 Inbox
`notifications` を新しい順。未読ドット。タップで deep link 先へ。「Mark all read」。

### 8.7 Account
Company（名前 / contact）/ **Referral fees**（`/employer/company.fees` を Web の `FeeSchedule` と同じ構成で表示）/ Change password / Notification preferences（kind ごとの toggle）/ Terms & Privacy（WebView）/ Sign out / バージョン表示。

---

## 9. 候補者アプリ仕様 — `Frog Recruit`

### 9.1 ナビゲーション
タブ 4 つ: **Home**（Introductions）/ **Profile** / **Activity**（Inbox）/ **Account**。

### 9.2 オンボーディングとゲート
`Login → (mustResetPassword) → (terms) → (consent: Web /consent と同文面。"Share my profile with employers Frog introduces me to" を明示的にタップ) → Push 事前説明（"Know the moment a company is interested"）→ Home`。
consent は revoke 可能だが、revoke 状態では Home に「Your profile is hidden from all employers」バナーを常時表示。

### 9.3 Home（Introductions）
- ヘッダー「Welcome back, {first}.」+ 完成度リング（`completeness`）。< 100 なら「Complete your profile」CTA。
- 「Introduced by Frog」セクション: 紹介カードを **横スワイプのフルブリードカルーセル**（Tinder 風の紙質感。**捨てるスワイプではなく閲覧の横送り**）。カード:
  ```
  ┌────────────────────────────────┐
  │ VIA FROG · Interviewing        │
  │ Palm                           │  ← company name
  │ 会社ブラーブ（URL 除去済み）    │
  │ ROLE FROG CONNECTED YOU TO     │
  │ Senior Backend Engineer        │
  │ Vancouver / remote             │
  │ ○──●──●──○──○                  │  ← Planned→Shared→Interviewing→Offer→Hired
  │ "statusNote"                   │
  │ [ I'm interested ] [ Talk to Frog first ]   ← §3-H
  │ Company website ↗   Updated Sep 14         │
  └────────────────────────────────┘
  ```
- ステータス表示: 前向き 5 段はステッパー、`declined` / `withdrawn` は終端バッジ（中立トーン。Web `INTRO_STATUS_LABELS` の文言に合わせる）。
- 反応（§3-H）: 1 回押すと保存され、カードに「You said: I'm interested · Frog has been notified」。変更可。企業には届かない旨をヘルプで明示。
- 空状態: Web `/me` と同文「No company introductions yet …」。

### 9.4 Profile
サブ画面: **Profile**（フォーム: displayName / headline / summary / locations / years / work auth（picker, `WORK_AUTH_LABELS`）/ visa notes / availability / English / desired salary + currency）/ **Experience**（リスト、追加・編集・スワイプ削除＋確認）/ **Links**（kind picker + URL）/ **Resume**（現在のファイル名・アップロード日、"Upload PDF"＝Files ピッカー（PDF のみ）、"View"、"Remove"。**iOS 書類スキャン→PDF は Phase 3**）/ **Preview**（`/candidate/preview` を企業視点レイアウトで表示。frogScore・推薦は出さない）。
保存は各画面の Save ボタン + 未保存離脱ガード。zod 検証エラーはフィールド直下に英語で。

### 9.5 Activity
Inbox。`employer.interested` は強調表示（mint 背景 + ♥）。

### 9.6 Account
**Sharing**（consent toggle。OFF にする前に確認ダイアログ「Employers will immediately lose access to your profile. Frog will be notified.」）/ **Request LinkedIn refresh**（URL 入力 → Slack）/ Change password / Notification preferences / Terms & Privacy / **Request account deletion** / Sign out / バージョン。

---

## 10. 共通仕様

- **デザイントークン**: §2 の色・フォントを `packages/ui/tokens.ts` に定義。フォントは `expo-font` で Inter + Source Serif 4 を同梱。角丸 12–16、カードは `paper` 地に `line` 1px + 薄い影。ボタン: primary = `brand` 地に白、outline = `line` 枠。危険 = `danger`。
- **アイコン**: `lucide-react-native`（Web と同じ lucide 系）。
- **アクセシビリティ**: 全ジェスチャに等価ボタン。Dynamic Type 対応（カードは最小 2 段階まで拡大許容、それ以上はスクロール化）。VoiceOver ラベル必須。減速モーション設定時はスワイプアニメを短縮。
- **状態管理**: TanStack Query（サーバ状態）+ Zustand（デッキ/Undo/キュー）。楽観更新は feedback と既読のみ。
- **トークン保存**: `expo-secure-store`。access はメモリ、refresh は SecureStore。401 → refresh → 再試行 1 回 → 失敗でログイン画面。
- **起動シーケンス**: `GET /meta`（強制更新判定）→ refresh → `GET /me`（ゲート判定）→ ルーティング。
- **Deep link スキーム**: `frogrecruit://`（candidate）/ `frogrecruit-employer://`（employer）。Push の `data.route` は `introductions/{id}` / `candidates/{id}` / `inbox`。
- **エラー表示**: ネットワーク = 上部バナー、検証 = フィールド、権限 = 画面差し替え（403 なら「This candidate is no longer available」→ 一覧へ）。
- **ログ**: 端末ログ・Sentry へ **候補者名・メール・本文** を出さない。API クライアントはレスポンスボディを breadcrumb に残さない。
- **スクリーンショット**: 防止しない。企業アプリの Resume 画面と詳細画面では `expo-screen-capture` の `addScreenshotListener` で **`view_audit` に `screenshot_detected` 相当を記録する** … は `view_audit.action` enum 変更を伴うため **Phase 3 で判断**（v1 は透かしのみ）。

---

## 11. セキュリティ・プライバシー要件（受け入れ条件）

1. 企業向け全読み取りが `getEffectiveGrant` / `listGrantedCandidateIds` を通る。**モバイル API から `internalNotesMd` / `noteInternal` / 候補者 email / `frogScore`（候補者側）を返す経路がゼロ**であることを、契約 zod の `strict()` と手動 grep で確認。
2. JWT クレームで認可しない。毎リクエスト DB で role / disabled / status を再確認。
3. refresh 回転 + 再利用検知。パスワード回転・無効化・削除でモバイルセッションと push token を即時失効。
4. Push ペイロードに PII なし（§7.1）。Push は `data.route/id` のみで詳細はアプリが取得。
5. レジュメは Bearer 必須の毎回透かし配信。アプリ内キャッシュはセッション終了で削除。共有導線なし。
6. 監査: モバイル経由の `view_list / view_detail / download_resume / submit_feedback` が Web と同一テーブルに残る。
7. `is_test` ユーザーの操作がメール・Slack を発火させない。
8. App Transport Security 既定（HTTPS のみ）。証明書ピンニングはしない。
9. アカウント削除依頼の導線がアプリ内にある。
10. 公開リポ（frog-recruit）に新規シークレットを置かない: `MOBILE_JWT_SECRET`, `EXPO_ACCESS_TOKEN` は `wrangler secret put`。APNs Auth Key（.p8）は EAS credentials にのみ保存。

---

## 12. Apple / App Store 要件

- Apple Developer Program: **組織アカウント（Frog Creator Production Inc.）**。D-U-N-S 必須。オーナー作業。
- Bundle ID: `com.frogagent.recruit`（候補者）/ `com.frogagent.recruit.employer`（企業）。表示名 `Frog Recruit` / `Frog Recruit for Employers`。カテゴリ Business。
- アイコン: 公式 Frog ロゴ（`frog-mailsystem/api/public/brand/logo-frog-w.png` 白版を `brand` 地に）。企業版は右下に小さな "E" バッジ等で識別。**🐸 絵文字・自作カエル禁止**（ルート AGENTS.md ルール #4）。
- Push: APNs Auth Key（.p8）を EAS に登録。`aps-environment` entitlement。
- Privacy Nutrition Label: Contact Info（email, name）・User Content（resume, work history）・Identifiers（device ID）。**Tracking なし**。
- 4.8 回避のため第三者サインインを載せない（§3-D）。5.1.1(v) 削除導線あり。
- **App Review 用アカウント**: 本番 D1 に `is_test=1` で `appreview+employer@frogagent.com`（Harborline Analytics 所属、Alex/Mika 等の架空候補者 3 名に grant 済み）と `appreview+candidate@frogagent.com`（架空紹介 2 件）を作成。認証情報は App Store Connect の Review Notes のみに記載。招待制である旨と、Frog が管理者発行する仕組みを Notes に明記。
- 輸出コンプライアンス: HTTPS のみ → 免除（`ITSAppUsesNonExemptEncryption=false`）。
- スクリーンショット: 6.9" / 6.5" 必須。デモデータで撮影（`src/lib/demo/mock-data.ts` を流用）。

---

## 13. 実装フェーズと受け入れ基準

| Phase | 範囲 | 完了条件（Definition of Done） |
|---|---|---|
| **0. Backend**（frog-recruit リポ） | §5 マイグレーション、§6.0 リファクタ、§6.2 全エンドポイント、§7 通知基盤、admin Action への `emit` / `revokeMobileSessions` 追記、`docs/SMOKE-TEST-MOBILE.md`（curl 手順） | (a) Web の既存スモーク（`docs/SMOKE-TEST.md`）が全て従来通り通る (b) curl で employer / candidate の全フローが通る (c) grant 作成 → `notifications` に `candidate.introduced` が 1 行だけ入る（2 回実行しても増えない） (d) Interested 送信 → 候補者に `employer.interested` 行 + 既存メール + Slack (e) `npm run build` と lint が通る (f) 本番 D1 にマイグレーション適用・デプロイ済み |
| **1. Employer app** | mobile リポ初期化（モノレポ、`packages/{api,ui,core}`、`apps/employer`）、§8 全画面、Push 受信と deep link、EAS Build → TestFlight | (a) 実機でログイン→デッキ→3 方向スワイプ→Undo→Inbox→Resume 閲覧が動く (b) 管理画面で grant を作ると **30 秒以内に実機に Push** が届き、タップで該当候補者が開く (c) 管理画面でパスワード回転 → 次の API 呼び出しでログアウトされる (d) Maestro E2E: ログイン / スワイプ 3 種 / Undo (e) TestFlight 内部配布 |
| **2. Candidate app** | `apps/candidate`、§9 全画面、consent ゲート、反応（§3-H）、レジュメアップロード | (a) 実機でログイン→consent→プロフィール編集→レジュメ PDF アップ→Preview (b) 企業（Web でも可）が Interested → 実機に Push、Activity に強調表示 (c) 管理画面で紹介ステータス変更 → Push (d) 企業がプロフィール閲覧 → 同日 2 回目は通知されない (e) TestFlight |
| **3. Polish / v1.1** | Universal Links + AASA、生体認証ロック、`grant.expiring` / Expo レシート照合の Cron（`wrangler.toml` `[triggers]`）、`candidate.resume_updated`、`frog.message` と admin 送信 UI、書類スキャン→PDF、スクリーンショット監査の判断、App Store 提出 | App Store 審査通過 |

概算工数（1 人 + Claude Code）: Phase 0 = 1.5–2 週 / Phase 1 = 2 週 / Phase 2 = 1.5 週 / Phase 3 = 1–2 週。

---

## 14. 起動プロンプト（コピペ用）

### 14-A. Phase 0 — バックエンド（frog-recruit で実行）
```
あなたは frog-recruit（Next.js 15 + OpenNext/Cloudflare + D1）のバックエンドを担当する。
まず frog-recruit/AGENTS.md と docs/IPHONE-APP-SPEC-PROMPT-FABLE.md を全文読むこと。
目的: iOS アプリ 2 本のためのモバイル API v1 と通知基盤を、Web 版の挙動を一切変えずに追加する。

実装順:
1. §5 のマイグレーション scripts/migrations/0009_mobile.sql と drizzle schema（src/lib/db/schema/mobile.ts、introductions.ts / auth.ts への列追加）。ローカル D1 に適用して確認。
2. §6.0 のリファクタ。Server Action は抽出したコアを呼ぶだけにし、Web の redirect / revalidatePath / 文言は一切変えない。
3. src/lib/api/v1/{auth,errors,contracts/*}.ts。Bearer JWT（MOBILE_JWT_SECRET, HS256, 15 分）+ 回転式 refresh（mobile_sessions, SHA-256 ハッシュ, 再利用検知）。requireMobile(request, { role }) は毎回 DB で role / disabled / mustReset / terms / consent を再確認する。
4. §6.2 の全エンドポイントを src/app/api/v1/** に route handler として実装。企業読み取りは必ず getEffectiveGrant / listGrantedCandidateIds を通し、buildEmployerCandidateView の DTO 以外を返さない。view_audit を Web と同じ action で書く。
5. §7 の通知基盤 src/lib/notify/{events,deliver,push,prefs,sessions}.ts。emit() は notifications の (user_id, dedupe_key) UNIQUE で冪等。Push は Expo Push API を getCloudflareContext().ctx.waitUntil() で送る。syncCandidateVisibility() を createGrant / saveRecommendation / enableConsent に、emit("employer.interested") を feedback コアに、emit("employer.viewed") を view_detail に、introduction 系 emit を upsertIntroduction / ensureIntroduction に、revokeMobileSessions() を §7.5 の全 Action に追記する。
6. users.is_test=1 のユーザーについて sendEmail / notifySlack を呼ぶ全箇所でスキップする。
7. docs/SMOKE-TEST-MOBILE.md に curl 手順を書き、自分で全て実行して結果を貼る。
8. 既存 docs/SMOKE-TEST.md の Web フローが従来通り動くことを確認してから、npm run build / lint、本番 D1 へマイグレーション、デプロイ。

制約: 英語のみの API エラー。公開リポなので新シークレットは wrangler secret put（MOBILE_JWT_SECRET, EXPO_ACCESS_TOKEN）。候補者 PII をログに出さない。§11 の 10 項目を最後にチェックリストとして自己検証し、根拠（ファイル:行）付きで報告する。
```

### 14-B. Phase 1 — モバイルリポ初期化 + 企業アプリ
```
新規 private リポ frog-recruit-mobile（Expo, TypeScript, expo-router, New Architecture, iOS のみ）を作る。
frog-recruit/docs/IPHONE-APP-SPEC-PROMPT-FABLE.md を全文読み、§3 の決定・§8・§10・§11・§12 に従う。

構成: npm workspaces モノレポ。apps/employer, apps/candidate（空の雛形）, packages/api（fetch クライアント + frog-recruit/src/lib/api/v1/contracts をコピーする scripts/sync-contracts.mjs）, packages/ui（トークン・共通コンポーネント・フォント）, packages/core（auth セッション、Push 登録、通知 Inbox、deep link）。
apps/employer: bundle com.frogagent.recruit.employer、表示名 "Frog Recruit for Employers"、userInterfaceStyle light、スキーム frogrecruit-employer。
画面: Login → forced reset → terms → push 事前説明 → タブ（Discover / Candidates / Inbox / Account）。Discover は §8.3 のカードデッキ（gesture-handler + reanimated、3 方向、スタンプ、Haptics、ボトムシート、3 秒 Undo の後に PUT）。Resume は Bearer 付き取得 → アプリ内 PDF ビューア、共有導線なし、Confidential バナー。
Push: expo-notifications。許可後に PUT /devices/push-token。受信タップで data.route へ遷移。フォアグラウンド受信は Inbox バッジ更新のみ。
API 呼び出しは packages/api 経由のみ。401 → refresh → 1 回再試行。GET /meta で強制更新。
テスト: Maestro でログイン / 3 方向スワイプ / Undo / Inbox 遷移。
配布: EAS Build（internal）→ TestFlight。APNs Key は EAS credentials に登録（リポに置かない）。
UI 文字列は英語のみ。ロゴは公式 Frog ロゴのみ使用。完了時に §13 Phase 1 の DoD を 1 項目ずつ実機で確認し、証跡（スクショ）付きで報告する。
```

### 14-C. Phase 2 — 候補者アプリ
```
frog-recruit-mobile の apps/candidate を実装する。frog-recruit/docs/IPHONE-APP-SPEC-PROMPT-FABLE.md §9 / §10 / §11 に従う。
bundle com.frogagent.recruit、表示名 "Frog Recruit"、スキーム frogrecruit。
ゲート: Login → forced reset → terms → consent（Web /consent と同文面、明示タップ）→ push 事前説明 → Home。
Home は紹介カードの横スワイプカルーセル（捨てるスワイプではない）、ステータスステッパー、§3-H の反応ボタン 2 つ（POST /candidate/introductions/:id/response）。
Profile は Profile / Experience / Links / Resume（Files から PDF のみ、multipart POST）/ Preview。Web の updateProfile と同じ zod 検証を contracts から使う。
Account: Sharing（revoke 前に確認ダイアログ）、LinkedIn refresh、パスワード変更、通知設定、Terms/Privacy、Request account deletion、Sign out。
Activity: employer.interested を強調表示。
packages/* は企業アプリと共有。重複実装したくなったら packages へ上げる。
完了時に §13 Phase 2 の DoD を実機で確認し報告。
```

### 14-D. Phase 3 — 仕上げと提出
```
frog-recruit と frog-recruit-mobile の両方で §13 Phase 3 を実施する: AASA 配信と Universal Links、生体認証ロック（expo-local-authentication、Account で ON/OFF）、wrangler.toml [triggers] の Cron で grant.expiring と Expo レシート照合、candidate.resume_updated、frog.message（admin UI は日本語のまま /admin に追加）、書類スキャン → PDF。
App Store 提出準備: §12 の Review アカウント作成（is_test=1, 架空データ）、Privacy Nutrition Label、スクリーンショット、Review Notes（招待制・管理者発行・デモ認証情報）。
```

---

## 15. 未決事項（オーナー確認待ち）

| # | 事項 | 既定 | 影響 |
|---|---|---|---|
| 1 | §3-H 候補者の反応ボタンを v1 に含めるか | 含める | Phase 2 の 1 画面 + API 1 本 + 列 2 本 |
| 2 | §3-I 「プロフィール閲覧」通知の既定 ON/OFF | ON | 候補者体験。OFF なら preferences 既定値を変えるだけ |
| 3 | Apple Developer 組織アカウントの取得（D-U-N-S） | オーナー作業 | Phase 1 の TestFlight 配布の前提。**着手直後に申請開始**を推奨（数日〜2 週間） |
| 4 | 既存 Google 招待候補者の credentials 移行方針 | 管理画面から順次発行 | 移行完了まで当該候補者はアプリ不可（Web は従来通り） |
| 5 | 企業アプリで氏名をカード表面に出さない案 | 出さない | 覗き見対策と職能優先。オーナーの好みで表面に出しても認可上の問題はない |
| 6 | Sentry 導入可否 | 導入（PII 無し設定） | 運用時のクラッシュ把握 |
| 7 | mobile リポの公開/非公開 | private | 公開にする理由がない |
