# Frog Recruit iOS — App Store 公開準備材料

> 目的: 審査提出**前**に揃えるもの。審査ボタンはオーナー確認後。
> 作成: 2026-09-18

## ステータス

| 項目 | 状態 |
|---|---|
| プライバシーポリシー（モバイル追記） | コード更新済 → 本番デプロイ必要 |
| App Review アカウントシード | `scripts/generate-app-review-seed.mjs` |
| ASC 文面・Review Notes・栄養ラベル | 本ドキュメント |
| スクリーンショット | 下記ショットリスト（実機/Sim 撮影） |
| 企業アプリ: 手数料非表示 / 削除導線 | コード更新済 → 新TFビルド必要 |
| 審査提出 | **まだ押さない** |

---

## 1. App Store Connect — 共通

| 項目 | 値 |
|---|---|
| 開発者 | Frog Creator Production Inc. / Team `9B65MF69MF` |
| カテゴリ | Business |
| 価格 | Free |
| 年齢 | 17+（採用・職歴。コンテンツはプロフェッショナル） |
| 輸出コンプライアンス | 免除（HTTPSのみ / `ITSAppUsesNonExemptEncryption=false` 済） |
| プライバシーポリシーURL | `https://recruit.frogagent.com/privacy` |
| サポートURL | `https://recruit.frogagent.com` （Contact: info@frogagent.com） |
| マーケティングURL | `https://recruit.frogagent.com` （任意） |

---

## 2. Frog Recruit（候補者）— ASC 6812968612

**表示名:** Frog Recruit  
**Subtitle:** Introductions from Frog  
**Bundle ID:** `com.frogagent.recruit`

### Description

```
Frog Recruit is the private iOS companion for candidates Frog introduces to hiring companies.

Accounts are issued by Frog — there is no public sign-up. Sign in with the email and password Frog sent you to:

• See introductions Frog is coordinating for you
• Respond (interested / consult / pass) when Frog asks for your take
• Keep your profile, experience, links, and PDF resume up to date
• Preview how employers see your shared materials
• Get notified when something needs your attention

Frog handles outreach to companies. You stay in control of what you share.
```

### Keywords

```
recruiting,career,job,introduction,resume,hiring,frog,candidate
```

### Promotional text（任意・変更しやすい）

```
Your Frog introductions — respond and keep your profile ready on iPhone.
```

### What’s New (1.0.0)

```
First release. Sign in with your Frog-issued account to manage introductions, profile, and resume.
```

### App Privacy（栄養ラベル）— Tracking: No

| データ | リンク済み | 用途 |
|---|---|---|
| Contact Info — Email Address, Name | Yes | App Functionality |
| User Content — Other User Content（resume, work history, profile） | Yes | App Functionality |
| Identifiers — Device ID | Yes | App Functionality（push / session） |

ATT不要。

### Review Notes（候補者）

```
ACCESS
This app is invitation-only. Frog (Frog Creator Production Inc.) issues candidate accounts after review. There is no self-serve registration.

Demo account (fictional data, is_test=1 — no real PII):
Email: appreview+candidate@frogagent.com
Password: <paste from ../.secrets/frog-recruit-app-review-credentials.txt>

HOW TO REVIEW
1. Sign in with the demo account.
2. Accept Terms if prompted (pre-accepted on demo).
3. Home shows fictional introductions coordinated by Frog.
4. Profile / Experience / Resume tabs show editable candidate materials.
5. Account → Request account deletion demonstrates Guideline 5.1.1(v).

WHY TWO APPS
“Frog Recruit” is for candidates. “Frog Recruit for Employers” is a separate product for hiring teams (different UX, privacy label, and notification copy). They are not duplicates (Guideline 4.3).

SIGN IN WITH APPLE
Not applicable — we do not offer third-party social login in the apps (email/password only).
```

---

## 3. Frog Recruit for Employers（企業）— ASC 6812968390

**表示名:** Frog Recruit for Employers  
**Subtitle:** Review Frog introductions  
**Bundle ID:** `com.frogagent.recruit.employer`

### Description

```
Frog Recruit for Employers is the private iOS app for hiring teams Frog works with.

Accounts are issued by Frog when we have a candidate we are confident introducing — there is no public sign-up.

• Review candidates Frog has granted you access to
• See Frog’s recommendation, strengths, and considerations
• Mark Interested / Pass (with optional notes) — Frog coordinates next steps
• Open watermarked PDF resumes in-app
• Get notified when Frog introduces someone new

You never contact candidates directly through this app. Frog manages outreach.
```

### Keywords

```
hiring,recruiting,employer,candidates,resume,frog,talent,introductions
```

### Promotional text

```
Review Frog’s curated introductions and respond from your iPhone.
```

### What’s New (1.0.0)

```
First release. Sign in with your Frog-issued employer account to review introductions.
```

### App Privacy — Tracking: No

| データ | リンク済み | 用途 |
|---|---|---|
| Contact Info — Email Address, Name | Yes | App Functionality |
| Identifiers — Device ID | Yes | App Functionality |
| Usage Data — Product Interaction（optional/view audit） | Yes | App Functionality / Analytics（社内監査） |

候補者の履歴書は「ユーザーが収集」ではなく、Frogが共有したコンテンツの閲覧。Nutrition Labelでは企業アプリ側は Contact + Identifiers を中心に。User Content は企業が入力するフィードバックコメントを Other User Content として App Functionality でよい。

### Review Notes（企業）

```
ACCESS
Invitation-only. Frog issues employer accounts when we have a strong candidate fit. No self-serve registration.

Demo account (fictional company & candidates):
Email: appreview+employer@frogagent.com
Password: <paste from ../.secrets/frog-recruit-app-review-credentials.txt>
Company: Harborline Analytics (fictional)

HOW TO REVIEW
1. Sign in.
2. Home / Review: three fictional candidates (Alex Rivera, Mika Chen, Jordan Blake) with Frog recommendations.
3. Open a candidate → view detail → optional watermarked resume.
4. Mark Interested or Pass — Frog is notified (demo accounts skip external email/Slack).
5. Account → Request account deletion for Guideline 5.1.1(v).

FEES
Referral fee schedules are intentionally NOT shown in the app (discussed offline with Frog). Avoids Guideline 3.1.1 confusion.

WHY TWO APPS
Separate candidate vs employer products (see candidate app notes). Different audiences and privacy disclosures.
```

---

## 4. スクリーンショット（必須サイズ）

Apple: **6.9"**（iPhone 16 Pro Max 相当）と **6.5"** が主。同じ構図を両サイズで。

保存先（推奨）:
`/Users/senna/src/frog-systems/frog-recruit-mobile/store-screenshots/{candidate,employer}/`

### 候補者（5枚想定）

1. Login — brand + “Request a Frog Recruit account”
2. Home — introductions list
3. Introduction detail / respond sheet
4. Profile edit
5. Account（deletion 導線が見えるとなお良い）

### 企業（5枚想定）

1. Login — request access CTA
2. Home — Action needed / candidates
3. Review deck / card with Frog recommendation
4. Candidate detail
5. Account（roles / legal / deletion）

撮影メモ:
- デモアカウントでログイン（本番API）
- ステータスバーはクリーン（機内モード可）
- 実在PIIを映さない
- 英語UIのみ

### レビュー用デモ動画（任意・推奨）

Loom / YouTube限定公開で 60–90秒。Review Notes にURL。
流れ: ログイン → 主要画面 → 1アクション（Interested or 候補者返答）→ Account。

---

## 5. シード適用手順

```bash
cd /Users/senna/src/frog-systems/frog-recruit
node scripts/generate-app-review-seed.mjs
set -a; source ../.env; set +a
npx wrangler d1 execute frog-recruit-db --remote --file=scripts/seed-app-review.sql
```

認証情報: `/Users/senna/src/frog-systems/.secrets/frog-recruit-app-review-credentials.txt`  
（公開リポに入れない。ASC Review Information にのみ貼る）

ログイン確認:
```bash
curl -sS -X POST https://recruit.frogagent.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"appreview+employer@frogagent.com","password":"<pw>","appVariant":"employer","device":{"id":"review","name":"App Review","appVersion":"1.0.0"}}'
```

（2026-09-18 本番シード適用済・ログイン確認済: employer 3候補 / candidate 2紹介）

---

## 6. 提出前チェックリスト（オーナー）

- [ ] 本番に privacy デプロイ済
- [ ] App Review シード適用・ログイン確認
- [ ] スクショをASCにアップロード（両アプリ・両サイズ）
- [ ] Review Notes + デモパスワード貼付
- [ ] Privacy Nutrition Label 入力
- [ ] 年齢・カテゴリ・価格確認
- [ ] 企業アプリ最新TFで手数料が消えている／削除導線がある
- [ ] デモ動画URL（任意）
- [ ] **Submit for Review**（このドキュメントではまだ押さない）
