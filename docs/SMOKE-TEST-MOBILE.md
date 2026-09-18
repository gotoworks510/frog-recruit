# モバイル API v1 スモークテスト

> Phase 0（`/api/v1/**` + 通知基盤）の curl 手順。正本の設計は
> [IPHONE-APP-SPEC-PROMPT-FABLE.md](./IPHONE-APP-SPEC-PROMPT-FABLE.md) と
> [IPHONE-APP-OWNER-DECISIONS.md](./IPHONE-APP-OWNER-DECISIONS.md)（矛盾時は後者が優先）。
> Web 側のフローは [SMOKE-TEST.md](./SMOKE-TEST.md) を別途通す。

API エラー・Push 文言は**英語のみ**。全レスポンスに `Cache-Control: no-store` が付く。

---

## 0. 前提

| 項目 | 内容 |
|---|---|
| ベースURL（本番） | `https://recruit.frogagent.com/api/v1` |
| ベースURL（ローカル） | `http://localhost:3005/api/v1`（`npm run dev`） |
| 必須シークレット | `MOBILE_JWT_SECRET`（HS256）。未設定だと `/auth/login` が 500 |
| 任意 | `EXPO_ACCESS_TOKEN`（Expo Push のレート上限緩和） |
| マイグレーション | `scripts/migrations/0009_mobile.sql` を対象 D1 に適用済みであること |

```bash
# ローカル D1（miniflare）へ適用。既に適用済みならエラーになるので無視してよい
npx wrangler d1 execute frog-recruit-db --local --file=scripts/migrations/0009_mobile.sql

# 本番 D1
npm run db:migrate:remote scripts/migrations/0009_mobile.sql

# シークレット
npx wrangler secret put MOBILE_JWT_SECRET
```

ローカル dev は `.env.local` の `DEV_D1_DATABASE_ID` が指す **DEV/STAGING の D1** に HTTP 接続する。
そちらにも 0009 を当てないと `/auth/login` が「no such table: mobile_sessions」で落ちる。

### テストアカウント

`users.is_test = 1` のアカウントは **Resend メールと Slack 通知をスキップ**し、Inbox と Push だけ動く（Fable §11-7）。
スモークは必ず is_test アカウントで行う。作成は `/admin/employers`・`/admin/candidates` から発行し、SQL でフラグを立てる:

```sql
UPDATE users SET is_test = 1 WHERE email IN ('emp@example.test','cand@example.test');
```

ダミー（`is_test=1`。DEV D1 と本番 D1 の両方）:

| ロール | メール | パスワード | サンプル内容 |
|---|---|---|---|
| 企業（Palm） | `emp@example.test` | `password` | Smoke Candidate / Alex Rivera を含む紹介候補が見える |
| 候補者 | `cand@example.test` | `password` | Palm と Northstar（DEVは CTC）への紹介 2 件 |
| 候補者2 | `cand2@example.test` | `password` | Palm への紹介 1 件（企業デッキ用の2人目） |

動作確認用の平文パスワード。`must_reset_password=0` 済み。
本番ビルド（TestFlight）は `https://recruit.frogagent.com/api/v1` を叩くので、アカウントは本番 D1 側が必要。

以下では次の変数を使う。

```bash
API=http://localhost:3005/api/v1
PW='password'
```

---

## 1. Meta（未認証）

```bash
curl -s $API/meta
# {"minAppVersion":{"candidate":"1.0.0","employer":"1.0.0"},"maintenance":{"active":false,"message":null}}
```

`MOBILE_MIN_VERSION_CANDIDATE` / `MOBILE_MIN_VERSION_EMPLOYER` / `MOBILE_MAINTENANCE` /
`MOBILE_MAINTENANCE_MESSAGE` で制御する（強制アップデート画面の判定に使う）。

---

## 2. ログイン（両バリアント）

### 2-1. 企業アプリ

```bash
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d "{
  \"email\": \"emp@example.test\",
  \"password\": \"$PW\",
  \"appVariant\": \"employer\",
  \"device\": { \"id\": \"smoke-emp-device\", \"name\": \"Senna's iPhone\", \"appVersion\": \"1.0.0\" }
}"
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "Oh6MPTkKybTfaiCmrN7sZV...",
  "expiresIn": 900,
  "user": {
    "id": "…", "name": "Smoke Employer", "email": "emp@example.test",
    "role": "employer", "company": { "id": "company_palm", "name": "Palm" }
  },
  "gates": { "mustResetPassword": false, "termsAccepted": true, "consentActive": true, "disabled": false }
}
```

### 2-2. 候補者アプリ

`appVariant` を `candidate` に、`email` を候補者アカウントに変えるだけ。

### 2-3. アプリ違いは 403

```bash
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d "{
  \"email\": \"emp@example.test\", \"password\": \"$PW\",
  \"appVariant\": \"candidate\", \"device\": { \"id\": \"x\" }
}"
# {"error":"wrong_app","message":"This account is for the Frog Recruit for Employers app."}
```

### 2-4. 失敗は本文一様（列挙防止）

存在しないメール・誤ったパスワード・無効化済みアカウントはすべて同じ 401 を返す。

```bash
# -> 401 {"error":"unauthorized","message":"Authentication required."}
```

以降は次のようにトークンを取り出して使う。

```bash
AT=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"emp@example.test\",\"password\":\"$PW\",\"appVariant\":\"employer\",\"device\":{\"id\":\"smoke-emp-device\"}}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')
```

---

## 3. Refresh（ローテーション・grace・再利用検知）

```bash
# 正規ローテ: 新しい access + 新しい refresh が返る。クライアントは必ず上書き保存する
curl -s -X POST $API/auth/refresh -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT\"}"
# {"accessToken":"…","refreshToken":"…","expiresIn":900}

# 直前の refresh を 60 秒以内に再提示 → 並行 refresh 救済で 200（セッションは殺さない）
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/auth/refresh \
  -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT\"}"   # -> 200

# 未知のトークン → 401（本文一様）
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/auth/refresh \
  -H 'Content-Type: application/json' -d '{"refreshToken":"totally-made-up"}'   # -> 401
```

**再利用検知**（owner §8）: grace 切れの previous、または既に revoke 済みセッションのトークンを提示すると
当該ユーザーの **全 `mobile_sessions` を `reuse_detected` で失効 + push token 削除 + Slack 警告**。
grace 切れを待たずに確認するには grace 期限を過去に倒す。

```bash
# grace を強制的に失効させてから、退いた refresh を再提示する
#   UPDATE mobile_sessions SET previous_grace_until = 1000 WHERE device_id = 'smoke-cand-device';
curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/auth/refresh \
  -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$OLD_RT\"}"   # -> 401

# 期待する DB 状態
#   SELECT revoked_reason, COUNT(*) FROM mobile_sessions WHERE user_id = '<id>' GROUP BY revoked_reason;
#     reuse_detected | 2
#   SELECT COUNT(*) FROM device_push_tokens WHERE user_id = '<id>';   -> 0
```

まだ期限内の access token もこの直後から 401 になる（`requireMobile` がセッション行を毎回読み直すため）。

---

## 4. パスワードリセット（セルフサービス）

```bash
# 常に同一レスポンス（アカウントの有無を漏らさない）
curl -s -X POST $API/auth/password-reset/request -H 'Content-Type: application/json' -d '{
  "email": "emp@example.test", "appVariant": "employer"
}'
# {"ok":true,"message":"If that email has a Frog Recruit account, we've sent a reset code. Check your inbox."}

# 存在しないメールでも完全に同じ本文が返る
curl -s -X POST $API/auth/password-reset/request -H 'Content-Type: application/json' -d '{
  "email": "nobody-at-all@example.test", "appVariant": "employer"
}'
```

`password_reset_tokens` に 1 行だけ入る（credentials かつ role が appVariant と一致するときのみ）。

```sql
SELECT user_id, app_variant, used_at IS NULL AS unused FROM password_reset_tokens;
```

メールには 30 分有効のリセットコードと `https://recruit.frogagent.com/reset-password?token=…` が入る
（`buildPasswordResetEmail`）。**この Web ページはまだ未実装** — 当面はアプリがコードを受け取って confirm を叩く。

```bash
curl -s -X POST $API/auth/password-reset/confirm -H 'Content-Type: application/json' -d '{
  "token": "<メールのコード>", "newPassword": "NewPassword!2026"
}'
# {"ok":true,"message":"Your password has been updated. Please sign in again."}
```

成功後は当該ユーザーの全 `mobile_sessions` が失効する（owner §5）。

---

## 5. 企業フロー（一覧 → 詳細 → フィードバック）

### 5-1. Home / 一覧

`bucket` は `action_needed` / `in_progress` / `new` / `interested` / `maybe` / `passed`。
`action_needed` = **このユーザーが未評価**、`in_progress` = 評価済み、または intro が
`interviewing` / `offer` / `hired`（owner §3）。

```bash
curl -s -H "Authorization: Bearer $AT" "$API/employer/candidates?bucket=action_needed"
```

```json
{
  "bucket": "action_needed",
  "counts": { "action_needed": 1, "in_progress": 0, "new": 1, "interested": 0, "maybe": 0, "passed": 0 },
  "candidates": [{
    "profileId": "…",
    "displayName": "Smoke Candidate",
    "headline": "Senior Backend Engineer",
    "yearsExperience": 8,
    "workAuthLabel": "IEC (Canada)",
    "locationPreference": "Vancouver / remote",
    "frogScore": 8.5,
    "recommendationExcerpt": "Deep Node.js and TypeScript experience Led payments platform migration",
    "considerationsExcerpt": "Needs IEC renewal in 2027",
    "targetRoleTitle": "Senior Backend Engineer",
    "targetRoleLocation": "San Francisco / Remote",
    "introducedAt": "2026-09-17T03:34:32.000Z",
    "introductionStatus": "shared",
    "myFeedback": null,
    "hasResume": false,
    "canDownloadResume": true
  }]
}
```

`view_list` 監査が 1 行増えることを確認する。

### 5-2. 詳細（`view_detail` 監査 + 候補者へ `employer.viewed`）

```bash
curl -s -H "Authorization: Bearer $AT" "$API/employer/candidates/$PROFILE_ID"
```

**PII チェック（必須）**: レスポンスに `internalNotesMd` / `noteInternal` / 候補者の email が
含まれないこと。内部メモに目印を入れて grep すると確実。

```bash
curl -s -H "Authorization: Bearer $AT" "$API/employer/candidates/$PROFILE_ID" | grep -c 'INTERNAL ONLY'   # -> 0
```

### 5-3. フィードバック（`clientRequestId` 必須）

```bash
REQ=$(uuidgen | tr 'A-Z' 'a-z')

curl -s -X PUT "$API/employer/candidates/$PROFILE_ID/feedback" \
  -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{
    \"interest\": \"interested\",
    \"wantsInterview\": true,
    \"questionsMd\": \"Availability for a 45 min intro call?\",
    \"clientRequestId\": \"$REQ\"
  }"
# {"feedback":{…,"updatedAt":"2026-09-17T03:35:16.742Z"},"newlyInterested":true,"idempotentReplay":false}
```

**同じ `clientRequestId` を再送**（オフラインキューの再試行）— 副作用なしで同じ結果が返る。
メール・Slack・Push は再送されず、`view_audit` も増えない。

```bash
curl -s -X PUT "$API/employer/candidates/$PROFILE_ID/feedback" \
  -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d "{\"interest\":\"interested\",\"wantsInterview\":true,\"clientRequestId\":\"$REQ\"}"
# {"feedback":{…},"newlyInterested":false,"idempotentReplay":true}
```

**`baseUpdatedAt` の競合** — サーバの方が新しければ 409 + 現在値（owner §9）。

```bash
curl -s -X PUT "$API/employer/candidates/$PROFILE_ID/feedback" \
  -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{
    \"interest\": \"maybe\",
    \"clientRequestId\": \"$(uuidgen | tr 'A-Z' 'a-z')\",
    \"baseUpdatedAt\": \"2020-01-01T00:00:00.000Z\"
  }"
# 409 {"error":"conflict","message":"This feedback changed on another device. …","current":{…}}
```

`baseUpdatedAt` の扱い:

| 送り方 | 意味 |
|---|---|
| キーを送らない | 競合チェックなし（常に上書き） |
| `null` | 「まだ評価は無いはず」と主張。行があれば 409 |
| ISO-8601 | サーバの `updatedAt` より古ければ 409 |

### 5-4. `interested` 初回遷移の副作用

```sql
SELECT kind, dedupe_key, push_status FROM notifications WHERE user_id = '<candidate user id>';
-- employer.interested | employer.interested:company_palm:1789616116742 | sent / skipped_no_device
SELECT action, COUNT(*) FROM view_audit WHERE actor_user_id = '<employer id>' GROUP BY action;
-- view_list / view_detail / submit_feedback
```

is_test アカウントなので **メールと Slack はスキップ**（dev ログに `[slack] skipped for is_test account`）。
`maybe` / `not_interested` は候補者へ一切通知しない。

### 5-5. 透かしレジュメ

```bash
curl -s -D- -o /tmp/resume.pdf -H "Authorization: Bearer $AT" \
  "$API/employer/candidates/$PROFILE_ID/resume"
# Content-Type: application/pdf / Cache-Control: no-store
# canDownloadResume=false → 403 / レジュメ未登録 → 404
```

`download_resume` 監査が毎回 1 行増え、会社名・閲覧者・日時の透かしが焼き込まれる。

---

## 6. 候補者フロー（consent 無しでも Home が見える）

### 6-1. Home

```bash
curl -s -H "Authorization: Bearer $CAT" $API/candidate/home
```

```json
{
  "profile": { "displayName": "Smoke Candidate", "headline": "Senior Backend Engineer", "completeness": 60, "hasResume": false },
  "consentActive": true,
  "introductions": [{
    "id": "…",
    "company": { "id": "company_palm", "name": "Palm", "blurb": "Business Identity infrastructure (San Francisco). …", "websiteUrl": "https://palm.com" },
    "status": "shared",
    "statusLabel": "Shared with company",
    "statusNote": "Frog shared your profile with Palm.",
    "jobs": [{ "title": "Senior Backend Engineer", "location": "San Francisco / Remote" }],
    "candidateResponse": null,
    "candidateRespondedAt": null,
    "updatedAt": "2026-09-17T03:34:32.000Z"
  }]
}
```

`noteInternal` は絶対に出ない（`grep -c 'INTERNAL ONLY'` → 0）。

### 6-2. 紹介カードへの返答（`interested` / `consult` / `pass`）

```bash
curl -s -X POST "$API/candidate/introductions/$INTRO_ID/response" \
  -H "Authorization: Bearer $CAT" -H 'Content-Type: application/json' -d "{
    \"response\": \"consult\",
    \"clientRequestId\": \"$(uuidgen | tr 'A-Z' 'a-z')\"
  }"
# {"introductionId":"…","response":"consult","respondedAt":"…","idempotentReplay":false}
```

同じ `clientRequestId` の再送は `idempotentReplay: true`。Slack は Frog にだけ飛び、**企業には通知しない**。
`pass` でも intro status は自動で `declined` にならない。

### 6-3. consent 撤回後の挙動（owner §6）

```bash
curl -s -X POST $API/candidate/consent -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"action":"revoke"}'
# {"consentActive":false}

# Home は 200 のまま（アプリは "Your profile is hidden from all employers" バナーを出す）
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CAT" $API/candidate/home   # -> 200

# プロフィール変更は 409 gate_required
curl -s -X PATCH $API/candidate/profile -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"headline":"Blocked edit","salaryCurrency":"USD"}'
# 409 {"error":"gate_required","message":"Turn sharing back on before changing your profile. …","gate":"consent"}

# 紹介への返答は consent 無しでも許可
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/candidate/introductions/$INTRO_ID/response" \
  -H "Authorization: Bearer $CAT" -H 'Content-Type: application/json' \
  -d "{\"response\":\"interested\",\"clientRequestId\":\"$(uuidgen|tr 'A-Z' 'a-z')\"}"   # -> 200

# 企業側からは即時不可視
curl -s -H "Authorization: Bearer $AT" "$API/employer/candidates" | grep -c '"profileId"'   # -> 0
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $AT" \
  "$API/employer/candidates/$PROFILE_ID"   # -> 404

# 再開
curl -s -X POST $API/candidate/consent -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"action":"enable"}'
# {"consentActive":true} — enable 後に syncCandidateVisibility が走り、
# 有効になった grant の企業に candidate.introduced が飛ぶ
```

### 6-4. プロフィール・職歴・リンク・レジュメ

```bash
curl -s -H "Authorization: Bearer $CAT" $API/candidate/profile
curl -s -X PATCH $API/candidate/profile -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"headline":"Senior Backend Engineer","salaryCurrency":"USD"}'

curl -s -X POST $API/candidate/experiences -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"company":"Smoke Corp","title":"Staff Engineer","isCurrent":true}'
curl -s -X PATCH $API/candidate/experiences/$EXP_ID -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"title":"Principal Engineer"}'
curl -s -X DELETE $API/candidate/experiences/$EXP_ID -H "Authorization: Bearer $CAT"

curl -s -X POST $API/candidate/links -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"kind":"github","url":"https://github.com/example"}'
curl -s -X DELETE $API/candidate/links/$LINK_ID -H "Authorization: Bearer $CAT"

# レジュメは multipart / PDF 限定（magic bytes 強制・10MB 上限）
curl -s -X POST $API/candidate/resume -H "Authorization: Bearer $CAT" -F file=@resume.pdf
curl -s -o /tmp/own-resume.pdf -H "Authorization: Bearer $CAT" $API/candidate/resume
curl -s -X DELETE $API/candidate/resume -H "Authorization: Bearer $CAT"

# 企業視点プレビュー（frogScore と推薦は含まない）
curl -s -H "Authorization: Bearer $CAT" $API/candidate/preview | grep -c frogScore   # -> 0
```

他人の experience / link の id を渡すと 404（所有権チェック）。

### 6-5. その他

```bash
curl -s -X POST $API/candidate/linkedin-refresh -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"url":"https://linkedin.com/in/example"}'   # 3回/時
curl -s -X POST $API/account/deletion-request -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"reason":"No longer job searching"}'
```

---

## 7. 通知・デバイス・アカウント（両アプリ）

```bash
# Inbox（新しい順・cursor ページング）
curl -s -H "Authorization: Bearer $CAT" "$API/notifications?limit=20"
# {"notifications":[{"id":"…","kind":"employer.interested","title":"Palm is interested in connecting",
#   "body":"Frog will reach out to you about next steps.",
#   "data":{"route":"introductions/…","id":"…"},"createdAt":"…","readAt":null}],
#  "nextCursor":null,"unreadCount":2}

curl -s -X POST $API/notifications/read -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"all":true}'
curl -s -X POST $API/notifications/read -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"ids":["<notification id>"]}'

# 種類別 Push 設定（ロールに該当する kind のみ）
curl -s -H "Authorization: Bearer $CAT" $API/notifications/preferences
#   employer.viewed は pushEnabled:false が既定（owner §4）
curl -s -X PUT $API/notifications/preferences -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"kind":"employer.viewed","pushEnabled":true}'
# 他ロール専用の kind を送ると 400
curl -s -X PUT $API/notifications/preferences -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"kind":"candidate.introduced","pushEnabled":true}'   # -> 400

# Push トークン
curl -s -X PUT $API/devices/push-token -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{
    "deviceId": "smoke-cand-device",
    "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "enabled": true
  }'
curl -s -X DELETE $API/devices/push-token -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"deviceId":"smoke-cand-device"}'

# アカウント
curl -s -H "Authorization: Bearer $CAT" $API/me
curl -s -H "Authorization: Bearer $CAT" $API/legal/terms      # {"version":"2026-09-16","url":"…/terms","html":null}
curl -s -H "Authorization: Bearer $CAT" $API/legal/privacy
curl -s -X POST $API/account/terms/accept -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"version":"2026-09-16"}'
curl -s -X POST $API/account/password -H "Authorization: Bearer $CAT" \
  -H 'Content-Type: application/json' -d '{"currentPassword":"…","newPassword":"NewPassword!2026"}'
#   → 他端末の mobile_sessions は失効、自分のセッションは生き残る
curl -s -X POST $API/auth/logout -H "Authorization: Bearer $CAT"
#   → 自セッション失効 + 同 device の push token 削除。以降 /me は 401
```

### Push 配送の確認

デバイス登録済み + 該当 kind が ON の状態で新しい dedupe key のイベントを起こすと、
`ctx.waitUntil` 経由で Expo Push API を叩き、結果が `notifications.push_status` に入る。

| `push_status` | 意味 |
|---|---|
| `sent` | Expo チケットが ok |
| `skipped_pref` | 当該 kind の Push が OFF |
| `skipped_no_device` | 有効な push token 無し |
| `DeviceNotRegistered` | 端末が失効 → `device_push_tokens.invalidated_at` を打つ |
| その他 | Expo のエラー文字列を `last_error` に記録 |

```sql
SELECT kind, push_status FROM notifications ORDER BY created_at DESC LIMIT 5;
SELECT enabled, invalidated_at IS NOT NULL, last_error FROM device_push_tokens WHERE user_id = '<id>';
```

---

## 8. 認可の境界（必ず通す）

| 確認 | 期待 |
|---|---|
| トークン無しで任意の `/api/v1` を叩く | `401 {"error":"unauthorized"}`（本文一様） |
| 企業トークンで `/candidate/*` | `403 wrong_app` |
| 候補者トークンで `/employer/*` | `403 wrong_app` |
| admin が無効化した直後の既存 access token | 401（セッションを毎回 DB 再確認） |
| `rotateEmployerPassword` / `rotateCandidatePassword` 後 | 全 `mobile_sessions` 失効 → 401 |
| `setEmployerDisabled(1)` / `setCandidateDisabled(1)` / `setCandidateStatus(rejected)` / `deleteEmployer` | 同上（`revoked_reason = 'admin'`） |
| grant 失効 / consent 撤回 | 企業の一覧から除外 + 詳細は 404 |
| 不正な JSON body | `400 {"error":"validation_failed","fields":[…]}`（値はエコーしない） |

```bash
for p in me candidate/home employer/candidates notifications; do
  printf '%-22s -> ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "$API/$p"
done   # すべて 401
```

---

## 9. 通知イベントの冪等性

`emit()` は `(user_id, dedupe_key)` の UNIQUE 制約で冪等。同じ操作を 2 回しても Inbox は増えない。

```bash
# 詳細を 2 回開く → employer.viewed は同一企業×同一日で 1 行だけ
curl -s -o /dev/null -H "Authorization: Bearer $AT" "$API/employer/candidates/$PROFILE_ID"
curl -s -o /dev/null -H "Authorization: Bearer $AT" "$API/employer/candidates/$PROFILE_ID"
```

```sql
SELECT kind, dedupe_key, COUNT(*) FROM notifications GROUP BY kind, dedupe_key;
-- employer.viewed | employer.viewed:company_palm:2026-09-17 | 1
```

管理画面側も同じ: `/admin/grants` で同じ grant を 2 回作っても
`candidate.introduced:{grantId}:{grantedAt}` は 1 行のまま（grantedAt が変わると新しい通知になる）。

---

## 10. 後片付け

```sql
DELETE FROM users WHERE email IN ('emp@example.test','cand@example.test');
-- FK cascade で profile / grant / recommendation / intro / mobile_sessions /
-- notifications / device_push_tokens も消える。view_audit は追記専用なので残る（意図通り）。
```
