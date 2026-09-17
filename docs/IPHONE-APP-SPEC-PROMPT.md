# Frog Recruit iPhoneアプリ — 設計・仕様プロンプト

> 作成: 2026-09-16 / 対象コミット: `c8b896c`
> 正本リポ: `/Users/senna/src/frog-systems/frog-recruit`（Windows正本: `C:\Users\gotow\Documents\frog-systems\frog-recruit`）
> 本番Web: https://recruit.frogagent.com

---

## 0. この文書の使い方

これは**実装エージェントへ渡すプロンプト本体**。先頭から順に実装してよい。

```
あなたはfrog-recruitのiPhoneアプリを実装する。
正本リポ: /Users/senna/src/frog-systems/frog-recruit
iOSリポ（新規）: /Users/senna/src/frog-systems/frog-recruit-ios

docs/IPHONE-APP-SPEC-PROMPT.mdを全文読んでから着手すること。
§10のフェーズ順に進め、各フェーズの「受け入れ条件」を満たしてから次へ進む。
既存の認可ロジック（getEffectiveGrant / listGrantedCandidateIds / buildEmployerCandidateView）は
絶対に複製せず、必ず既存関数を呼ぶこと。これを破ると候補者PIIが漏れる。
```

守るべき既存ルール（ルート`AGENTS.md`・`frog-recruit/AGENTS.md`より）:

- 作業前に対象ディレクトリで`git fetch` → `git status -sb`。behindなら先に`git pull`
- frog-recruitは**publicリポ**。秘密情報と候補者PIIはコミット禁止
- 候補者・企業向けの文言はすべて**英語**。admin向けのみ日本語
- 成果物パスは毎回フルパスで報告

---

## 1. ゴールと、変えてはいけないもの

### 1.1 やること

Web版のうち**候補者面(`/me`)と企業面(`/portal`)**をiPhoneネイティブ化する。Tinder型のカードスワイプで企業の候補者裁定を高速化し、双方にプッシュ通知を届ける。

- 企業側: 新しい候補者が届いたら通知 → その場でスワイプ裁定
- 候補者側: 企業からアクションがあったら通知 → その場で応答

### 1.2 やらないこと

- **admin面(`/admin`)はアプリ化しない**。Frogスタッフの運用はWebのまま。理由は入力量が多く、スマホに落とす価値が薄いため
- Webの既存UIは変更しない。追加するのはAPI層のみ
- アプリ内課金・アプリ内決済は入れない（紹介手数料はFrogがオフラインで請求）

### 1.3 絶対に壊してはいけない不変条件

ここがこのプロダクトの心臓部。API層を足すときに最も壊しやすい。

1. **行レベル認可は`src/lib/auth/grant.ts`が唯一の正本**。企業が候補者を見られる条件は、grantが有効(未失効・未期限切れ) **かつ** 候補者のconsentが有効 **かつ** その会社向けまたは汎用のpublished+shared recommendationが存在すること。モバイルAPIも必ず`getEffectiveGrant()`／`listGrantedCandidateIds()`を通す
2. **企業へ返すのは`buildEmployerCandidateView()`のDTOだけ**。`internalNotesMd`・候補者の生メール・R2キーは絶対に含めない
3. **Frogスコア(`recommendations.frogScore`)は企業専用**。候補者アプリのどこにも出さない（`src/lib/employer/frog-score.ts`のコメント通り）
4. **レジュメはPDF限定、都度透かし焼き込み**。durable URLやpre-signed URLを作らない。企業への配信は必ずアプリ経由でストリームし、`view_audit`に追記する
5. **`view_audit`は追記専用**。削除経路を作らない
6. **Frogキュレーションを迂回しない**。スワイプは「Frogが選んだ候補者に対する裁定」であって、候補者データベースの自由閲覧ではない。デッキに出るのはgrant済みの候補者のみ

---

## 2. アプリ構成の決定

### 2.1 2アプリ、1リポジトリ、共有フレームワーク

| | 候補者アプリ | 企業アプリ |
|---|---|---|
| 表示名 | `Frog Recruit` | `Frog Recruit for Employers` |
| Bundle ID | `com.frogagent.recruit.candidate` | `com.frogagent.recruit.employer` |
| 配布 | App Store（招待ユーザーのみログイン可） | App Store（同上）※2026-09-16オーナー決定 |
| 主UI | プロフィール育成＋紹介パイプライン | カードスワイプデッキ |

1アプリにロール分岐を載せる案は却下する。UXが根本的に違ううえ、App Storeのプライバシーラベル（候補者アプリは職歴・履歴書を収集、企業アプリは収集しない）と通知許諾の文言が分けられないため。

実体は**1リポジトリ・1つの`project.yml`・3ターゲット**にする。コードの大半は共有フレームワークに置く。

```
/Users/senna/src/frog-systems/frog-recruit-ios/
  project.yml                    # XcodeGen正本（FrogCompassに倣う）
  FrogRecruitKit/                # framework target（共有）
    Networking/                  # APIClient, AuthStore, TokenRefresher
    Models/                      # Codable DTO（サーバのTS型と1:1）
    Push/                        # DeviceRegistrar, NotificationRouter
    Storage/                     # KeychainHelper
    DesignSystem/                # FrogTheme, カード, ボタン
  CandidateApp/
    Features/ Resources/ Info.plist
  EmployerApp/
    Features/ Resources/ Info.plist
  FrogRecruitUITests/
  scripts/                       # build-simulator.sh, upload-testflight.sh
```

### 2.2 技術スタック（FrogCompassの慣習を踏襲）

- **SwiftUI 100%**、UIKitはPDFKitと`UIActivityViewController`のブリッジのみ
- **XcodeGen**で`.xcodeproj`を生成（`.gitignore`対象）。Team ID `9B65MF69MF`、`CODE_SIGN_STYLE: Automatic`
- **Deployment Target iOS 17.0**、Swift 5、iPhone専用（`TARGETED_DEVICE_FAMILY: "1"`）、Portrait固定
- **SPM外部依存ゼロ**。スワイプUIもカードスタックも自前実装する（`DragGesture` + `offset` + `rotationEffect`）
- 状態管理は**`@Observable`(Observation framework, iOS 17+)**。FrogCompassは`ObservableObject`だが新規なので`@Observable`でよい。`@Environment`で注入
- ネットワークは`URLSession`直叩き。`FrogCompass`の`FrogAPI`プロトコル + Real/Mock二重実装パターンを踏襲し、`FROG_USE_MOCK_API=1`でUIテストを決定的にする

### 2.3 デザイン

Web版のブランドトークン`--color-brand: #0f3024`（`src/app/globals.css`）を基準に、`FrogRecruitKit/DesignSystem/FrogTheme.swift`へ写経する。FrogCompassの`FrogTheme`（Duolingo風・2ptボーダーカード・3D押し込みボタン）をベースにしてよいが、Recruitは**B2B寄りの落ち着いたトーン**にする。絵文字UIは禁止、SF Symbolsを使う。公式Frogロゴ（卒業帽のカエル）のみ使用し、🐸絵文字で代用しない。

---

## 3. Tinderメタファーのマッピング（中核設計）

### 3.1 企業側スワイプ = 既存の`candidate_feedback`

**スキーマ変更なしで既存テーブルにそのまま落ちる**。これが最重要の設計判断。

| ジェスチャー | 意味 | `candidate_feedback`への書き込み |
|---|---|---|
| 右スワイプ | Interested | `interest='interested'`, `wantsInterview=false` |
| 上スワイプ | Interested + 面接希望 | `interest='interested'`, `wantsInterview=true` |
| 左スワイプ | Pass | `interest='not_interested'` ＋ 理由シートを出す |
| タップ / 下フリック | 詳細を開く | 書き込みなし。`view_audit`に`view_detail` |
| 「Later」ボタン | 保留 | `interest='maybe'`。デッキ末尾へ戻す |

- 左スワイプ後は`DECLINE_REASONS`（`src/lib/employer/feedback.ts`）のチップを出すシートを表示。スキップも可能にする（`declineReasons`は空配列でよい）
- 右／上スワイプ後は`questionsMd`を書ける任意のシートを出す。スキップ可
- **Undo**: 直前1件だけ取り消せる。`candidate_feedback`はupsertなので再送で上書きできる。ただし`interest='interested'`への初回遷移でメールとSlack通知が飛ぶため、**サーバ側に到達する前のローカル取り消しのみ許す**（スワイプ後3秒のスナックバー内でのみUndo可、その間は送信を遅延させる）

デッキの性質はTinderと違い**有限で希少**。Frogが厳選した数名しか入らない。これは弱点ではなく売り。デッキが空のときは「Frog is curating your next candidates」を出し、件数を偽装しない。

### 3.2 候補者側スワイプ = `candidate_introductions`の拡張

候補者が求人を自由に漁るモデルにはしない（2026-09-16オーナー決定）。Frogが紹介した企業に対して応答するモデルにする。`jobs`テーブルを候補者に開放するオープンな求人一覧は**作らない**。

`candidate_introductions`（(candidate, company)でUNIQUE）に候補者の返事カラムを足す。新テーブルは作らない。

| ジェスチャー | 意味 | 書き込み |
|---|---|---|
| 右スワイプ | この会社に興味あり | `candidateResponse='interested'` |
| 左スワイプ | 見送る | `candidateResponse='declined'` ＋ 任意メモ |
| タップ | 会社・求人の詳細 | 書き込みなし |

候補者のデッキに入るのは、`status`が`shared`以上、かつ`candidateResponse='pending'`の紹介。つまり**企業に共有済みの案件だけ**が候補者に見える。

### 3.3 Match（相互マッチ）

```
企業: candidate_feedback.interest = 'interested'
  AND
候補者: candidate_introductions.candidateResponse = 'interested'
  ↓
candidate_introductions.matchedAt = now
  ↓ 通知3方向
  企業へ push:  "It's a match — {Candidate} wants to talk"
  候補者へ push: "It's a match — {Company} wants to talk"
  Frogへ Slack:  面談セットアップの依頼
```

マッチしても**アプリ内チャットは作らない**（2026-09-16オーナー決定）。Frogが間に立って面談を設定するのがこのサービスの価値であり、直接連絡を許すと中抜きされる。将来の拡張余地としても残さない。マッチ後の画面は「Frog will contact you within 1 business day」と、`candidate_introductions.status`の進捗表示（`shared` → `interviewing` → `offer` → `hired`）に留める。ステータスはadminがWebから進める既存フローのまま。

判定ロジックは`src/lib/match/resolve.ts`（新規）に置き、企業側フィードバック保存と候補者側応答保存の**両方から呼ぶ**。どちらが後に来てもマッチが成立するようにする。`matchedAt`が既に入っていれば何もしない（冪等）。

---

## 4. バックエンド追加 — モバイルAPI層 `/api/v1`

### 4.1 なぜ必要か

現状の書き込みは全部Server Actions（RSCのform POST）で、読み出しはRSCのサーバコンポーネント。JSONで叩ける口は`/api/profile/resume`、`/portal/candidates/[id]/resume`、`/api/desk/job-leads`、`/api/admin/view-as`しかない。ネイティブアプリからは使えないので、`src/app/api/v1/`にJSON RESTを新設する。

**既存のServer Actionsは残す。** ビジネスロジックを`src/lib/*/service.ts`に抽出し、Server ActionとAPI route handlerの両方から呼ぶ形にリファクタする。ロジックを二重に書かない。

### 4.2 認証方式

**メール＋パスワードのみ。アプリにGoogleサインインを載せない。**

理由: App Store Reviewガイドライン4.8により、サードパーティのSNSログイン（Google）を提供するアプリはSign in with Appleの併設が必要になる。独自のメール／パスワード認証だけなら対象外。Web側は既に`authProvider='credentials'`＋PBKDF2で候補者・企業の両方に対応済み(`candidate_accounts` / `employer_accounts`)なので、新方式を作る必要がない。

Google招待で入った既存候補者には、アプリ初回利用時に「Set a password for the app」導線を出す。実装はadminの`rotateCandidatePassword`と同じメール経路を、候補者自身が引ける`POST /api/v1/auth/forgot`として公開する。

トークン設計:

| | 中身 | 寿命 | 保管 |
|---|---|---|---|
| Access token | JWT（HS256、`AUTH_SECRET`で署名）。claims: `sub`, `role`, `companyId`, `status`, `appVariant`, `jti` | 15分 | アプリのメモリのみ。ディスクに書かない |
| Refresh token | 不透明ランダム32バイトのbase64url。D1の`mobile_sessions`にSHA-256ハッシュで保存 | 60日（使うたび延長） | Keychain（`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`） |

- リフレッシュは**ローテーション**する。使用済みrefresh tokenは即無効化し、再利用を検知したらそのユーザーの全セッションを失効させる（トークン窃取対策）
- ログイン失敗は既存の`loginRateLimit(ip)`（KV、10回/15分）を再利用し、さらに`rl:login:dev:{deviceId}`で端末単位にも掛ける
- `mustResetPassword` / `termsAcceptedAt` / `privacyConsentedAt`のゲートはWebと同じ条件で評価し、`GET /api/v1/me`の`gates`で返す。アプリはこれを見て強制画面を出す

### 4.3 エンドポイント一覧

共通仕様:

- ベース: `https://recruit.frogagent.com/api/v1`
- 認証: `Authorization: Bearer {accessToken}`
- 成功: `200 {"data": ...}` / 失敗: `{"error": {"code": "...", "message": "..."}}`
- エラーコード: `unauthenticated` / `token_expired` / `forbidden` / `not_found` / `rate_limited` / `validation_failed` / `gate_required`
- ページングはカーソル方式: `?cursor=&limit=`、レスポンスに`nextCursor`
- 全レスポンスに`Cache-Control: no-store`
- `X-App-Variant: candidate|employer`と`X-App-Build`を必須ヘッダにし、将来の強制アップデートに使う

#### 認証

| Method | Path | 認証 | 用途 |
|---|---|---|---|
| POST | `/auth/login` | なし | `{email, password, deviceId, appVariant}` → token pair + user |
| POST | `/auth/refresh` | なし | `{refreshToken}` → 新pair（ローテーション） |
| POST | `/auth/logout` | 要 | このrefresh tokenと端末トークンを失効 |
| POST | `/auth/password` | 要 | `{currentPassword, newPassword}` |
| POST | `/auth/forgot` | なし | `{email}` → 仮パスワードをメール送信。**常に200を返す**（アカウント存在を漏らさない） |

#### 共通(me)

| Method | Path | 用途 |
|---|---|---|
| GET | `/me` | user + `gates:{needsTerms,needsConsent,needsPasswordReset,disabled}` + `unreadCount` |
| POST | `/me/terms` | 規約同意。`termsAcceptedAt`/`termsVersion`を書く |
| POST | `/me/consent` | 候補者のみ。`share_with_employers`のconsentを作る |
| DELETE | `/me/consent` | 候補者のみ。全activeconsentに`revokedAt` |
| GET | `/me/notifications` | アプリ内Inbox（カーソルページング） |
| POST | `/me/notifications/read` | `{ids:[...]}` または `{all:true}` |
| GET / PUT | `/me/notification-prefs` | 種別ごとのpush/emailオンオフ |
| POST | `/me/devices` | `{deviceToken, environment, appVariant, locale, appBuild}` をupsert |
| DELETE | `/me/devices/{deviceToken}` | ログアウト時に呼ぶ |

#### 候補者

| Method | Path | 用途 |
|---|---|---|
| GET | `/candidate/profile` | profile + experiences + links + `completeness` |
| PATCH | `/candidate/profile` | 部分更新。`updateProfile`と同じバリデーションと`completeness`再計算 |
| POST / PATCH / DELETE | `/candidate/experiences[/{id}]` | 所有権チェック必須（profile一致） |
| POST / DELETE | `/candidate/links[/{id}]` | 同上 |
| POST | `/candidate/resume` | multipart。PDF magic-byte検証（`validateMagicBytes`）→ R2 |
| DELETE | `/candidate/resume` | R2削除 + profileをnull |
| GET | `/candidate/resume` | 自己閲覧。**透かしなし**（既存`/api/profile/resume`と同じ挙動） |
| GET | `/candidate/preview` | 企業から見た自分。`buildEmployerCandidateView`から**frogScoreを除去**して返す |
| GET | `/candidate/deck` | 未応答の紹介カード（`status`が`shared`以上 かつ `candidateResponse='pending'`） |
| GET | `/candidate/introductions` | パイプライン全件。company, status, statusNote, employerInterested, matchedAt |
| POST | `/candidate/introductions/{id}/respond` | `{response:'interested'\|'declined', note?}` → マッチ判定を呼ぶ |
| GET | `/candidate/activity` | 自分に関する`view_audit`の要約。**会社名と日時のみ**、閲覧者個人は出さない |
| POST | `/candidate/linkedin-refresh` | 既存`requestLinkedInRefresh`のJSON版（レート制限3回/時を維持） |

`/candidate/introductions`が返してよいのは`statusNote`まで。`noteInternal`はadmin専用なので絶対に含めない。

#### 企業

| Method | Path | 用途 |
|---|---|---|
| GET | `/employer/deck` | 未裁定の候補者カード。`listGrantedCandidateIds`から`candidate_feedback`に行のあるものを除外。最大20件プリフェッチ |
| GET | `/employer/candidates` | `?filter=all\|interested\|maybe\|passed\|matched` |
| GET | `/employer/candidates/{profileId}` | `getEffectiveGrant`必須 → `buildEmployerCandidateView(db, id, {companyId})`。`view_detail`をaudit |
| POST | `/employer/candidates/{profileId}/feedback` | `{interest, wantsInterview, questionsMd, declineReasons[], declineNote}`。既存`saveCandidateFeedback`から抽出した共通サービスを呼ぶ |
| GET | `/employer/candidates/{profileId}/resume` | `canDownloadResume`確認 → `watermarkPdf`で焼き込み → `download_resume`をaudit → ストリーム |
| POST | `/employer/candidates/{profileId}/screenshot` | アプリがスクショ検知したら送る。`view_audit`に`screenshot_taken` |
| GET | `/employer/company` | 自社情報とオープン求人 |

`/employer/fees`は**アプリに載せない**（§9のApp Store審査参照）。

### 4.4 実装上の注意

- route handlerは`export const runtime = 'edge'`相当（OpenNextのデフォルト）。Node専用APIを使わない
- `getEffectiveGrant`はリクエストごとに評価する。結果をキャッシュしない。consent取り消しやgrant失効が**次のリクエストで即403**になる現在の性質を保つ
- 既存Server Actionsからロジックを抽出する際は、`redirect()`と`revalidatePath()`をサービス関数の外に出す。サービス関数は値を返すだけにする
- Zodでリクエストボディを検証する（既に依存にある）

---

## 5. スキーマ変更 — `scripts/migrations/0009_mobile.sql`

手書きマイグレーションが正本（`scripts/migrations/`）。drizzleスキーマも同時に更新すること。

```sql
-- 端末トークン
CREATE TABLE device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  app_variant TEXT NOT NULL,          -- 'candidate' | 'employer'
  environment TEXT NOT NULL,          -- 'sandbox' | 'production'
  bundle_id TEXT NOT NULL,
  locale TEXT,
  app_build TEXT,
  last_seen_at INTEGER NOT NULL,
  disabled_at INTEGER,                -- APNs 410 BadDeviceTokenで埋める
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_device_token ON device_tokens(device_token);
CREATE INDEX idx_device_user ON device_tokens(user_id);

-- モバイルのrefresh token（ハッシュのみ保存）
CREATE TABLE mobile_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_id TEXT NOT NULL,
  app_variant TEXT NOT NULL,
  rotated_from TEXT,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_mobile_refresh ON mobile_sessions(refresh_token_hash);
CREATE INDEX idx_mobile_user ON mobile_sessions(user_id);

-- アプリ内Inbox兼、送信の冪等化キー
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  deep_link TEXT,
  data_json TEXT,
  dedupe_key TEXT,                    -- 同一イベントの二重送信防止
  read_at INTEGER,
  pushed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_notif_user_created ON notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX uq_notif_dedupe ON notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 通知設定（行が無ければ既定ON）
CREATE TABLE notification_prefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  email_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_pref_user_kind ON notification_prefs(user_id, kind);

-- 候補者側の応答とマッチ
ALTER TABLE candidate_introductions ADD COLUMN candidate_response TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE candidate_introductions ADD COLUMN candidate_responded_at INTEGER;
ALTER TABLE candidate_introductions ADD COLUMN candidate_note TEXT;
ALTER TABLE candidate_introductions ADD COLUMN matched_at INTEGER;
```

drizzle側の追加enum:

- `candidateIntroductions.candidateResponse`: `'pending' | 'interested' | 'declined'`
- `viewAudit.action`に`'screenshot_taken'`を追加（SQLiteに制約は無いのでdrizzleの型のみ）

---

## 6. 通知設計

### 6.1 APNs送信基盤

**Cloudflare Workersから`fetch()`で直接APNsを叩ける。** Cloudflareの本番プロキシスタックがHTTP/2にアップグレードするため（`cloudflare/workerd#4841`でKenton Vardaが確認済み）。外部サービス不要。

**ただし`wrangler dev`(workerd)はHTTP/2非対応なのでローカルではAPNsに到達できない。** ローカルはコンソール出力のスタブに切り替え、プッシュの検証は必ずデプロイ済みWorkerで行う。これを知らないと「ローカルで動かない」に何時間も溶かす。

実装: `src/lib/push/apns.ts`（外部依存なし、WebCryptoのみ）

```
1. ES256のJWTを組む
   header: { alg: 'ES256', kid: APNS_KEY_ID }
   claims: { iss: APNS_TEAM_ID, iat: now }
   鍵: APNS_KEY_P8（.p8のPKCS#8）をcrypto.subtle.importKey('pkcs8', ..., {name:'ECDSA', namedCurve:'P-256'})
   JWTは最大1時間有効。KVに50分キャッシュして再利用する（毎回署名しない）

2. POST https://api.push.apple.com/3/device/{deviceToken}
   （environment='sandbox'の端末はapi.sandbox.push.apple.com）
   headers:
     authorization: bearer {jwt}
     apns-topic: {bundleId}           # 端末行のbundle_idを使う
     apns-push-type: alert
     apns-priority: 10
     apns-collapse-id: {dedupeKey}    # 同種通知の上書き
     apns-expiration: {now + 24h}

3. レスポンス処理
   200 → notifications.pushed_atを埋める
   410または400 BadDeviceToken → device_tokens.disabled_atをセット
   429 / 5xx → 1回だけ指数バックオフで再試行。それ以上は諦めてログ
```

必要なWorkerシークレット（`wrangler secret put`）: `APNS_KEY_P8`、`APNS_KEY_ID`、`APNS_TEAM_ID`。`[vars]`に`APNS_BUNDLE_CANDIDATE`、`APNS_BUNDLE_EMPLOYER`。

送信は**`ctx.waitUntil()`でfire-and-forget**にし、Server ActionやAPIのレスポンスをブロックしない。v1はこれで足りる。件数が増えてきたらCloudflare Queues（Workers Paidが必要）に移す。

`sendNotification(db, { userId, kind, title, body, deepLink, data, dedupeKey })`が唯一の入口。この関数が、(1)`notifications`に1行入れる、(2)`notification_prefs`を見てpushを出すか判断する、(3)有効な`device_tokens`全件へ送る、を担当する。

### 6.2 通知の種類

**企業向け**（`appVariant='employer'`、その会社の全employerユーザーへ）

| kind | トリガー | 本文（英語） | deepLink |
|---|---|---|---|
| `new_candidate` | grantが有効化された瞬間。`saveRecommendation`のpublished+shared時の`autoGrantCompanyEmployers`、および`createGrant` | "A new candidate is ready for review" | `…://deck` |
| `match` | 相互マッチ成立 | "It's a match — {Candidate} wants to talk" | `…://candidate/{profileId}` |
| `deck_reminder` | 未裁定カードが3件以上で48時間動きなし。Cron日次 | "{n} candidates are waiting for your review" | `…://deck` |
| `grant_expiring` | `expiresAt`の3日前。Cron日次 | "Access to {n} candidate profiles expires in 3 days" | `…://deck` |

**候補者向け**（`appVariant='candidate'`）

| kind | トリガー | 本文（英語） | deepLink |
|---|---|---|---|
| `employer_interested` | `candidate_feedback`が初めて`interested`になった時。既存のメール送信と同じ箇所 | "{Company} is interested in your profile" | `…://introduction/{id}` |
| `interview_request` | 同上かつ`wantsInterview=true` | "{Company} would like to interview you" | `…://introduction/{id}` |
| `match` | 相互マッチ成立 | "It's a match — Frog will contact you shortly" | `…://introduction/{id}` |
| `intro_status_changed` | adminが`upsertIntroduction`でstatusを進めた時 | "{Company}: {status}" ＋ `statusNote`があれば併記 | `…://introduction/{id}` |
| `profile_nudge` | `completeness < 70`が7日継続。Cron週次 | "Your profile is {n}% complete — finish it to get referred" | `…://profile` |
| `new_introduction` | adminが新しい紹介を`shared`にした時 | "Frog referred you to a new company" | `…://deck` |

Cron: `wrangler.toml`に`[triggers] crons = ["0 16 * * *"]`（16:00 UTC = 09:00 PT）を追加し、`src/app/api/cron/notifications/route.ts`で日次ジョブを回す。

### 6.3 通知とPII

候補者名や会社名をロック画面に出すかは慎重に決める。

- **既定では出さない。** 企業向け`new_candidate`は職種も名前も出さず "A new candidate is ready for review" のみ。候補者向けは会社名を出す（既存のメール`buildCandidateEmployerInterestEmail`で既に会社名を伝えているので整合する）
- アプリの設定に "Show details in notifications" を用意し、オンにした場合のみ候補者名・職種を本文に入れる
- 通知ペイロードの`data`に候補者の生メールや`internalNotesMd`を**絶対に入れない**。APNsペイロードはAppleのサーバを通過する
- ペイロードは4KB上限。`data`はIDとdeepLinkだけにし、中身はアプリがAPIから取りに行く

### 6.4 許諾の取り方

起動直後に`requestAuthorization`を呼ばない。承諾率が落ちる。

- 企業アプリ: **最初のスワイプを1枚終えた直後**に、価値を説明するpre-permission画面を出してから`requestAuthorization`
- 候補者アプリ: **プロフィールを保存した直後**、または最初の紹介が届いた画面で出す
- 拒否された場合はアプリ内Inbox（`/me/notifications`）で代替し、設定アプリへの導線を1箇所だけ置く
- 許諾後、`didRegisterForRemoteNotificationsWithDeviceToken`で`POST /api/v1/me/devices`。トークンが前回と同じなら送らない（無駄な書き込みを避ける）
- `environment`はビルド構成で決める。Debug/TestFlightビルドは`sandbox`、App Store配布は`production`。ここを間違えると410で全滅する

---

## 7. iOS実装仕様

### 7.1 企業アプリ — 画面

| 画面 | 内容 |
|---|---|
| Login | メール＋パスワード。`mustResetPassword`なら強制パスワード変更へ |
| Terms gate | `needsTerms`時に全画面。同意しないと進めない |
| **Deck**（ホーム） | カードスタック。3枚まで実描画、残りはプリフェッチ。空状態は"Frog is curating your next candidates" |
| Card detail | フルプロフィール。experiences、links、Frogの推薦文（strengths / considerations）、Frog Scoreバッジ、レジュメボタン |
| Resume viewer | PDFKitでアプリ内表示のみ。**共有シート・保存・印刷は無効**。スクショ検知で`/screenshot`へ送信 |
| Reviewed | 裁定済み一覧。`interested` / `maybe` / `passed` / `matched`でフィルタ |
| Notifications | アプリ内Inbox |
| Settings | 通知設定、パスワード変更、ログアウト |

カードに出す情報（`EmployerCandidateView`から）: `displayName`、`headline`、`yearsExperience`、`locationCurrent`、`workAuthStatus`、希望年収レンジ、直近の職歴1件、`techStack`のチップ、Frog Scoreバッジ、`hasResume`の有無。

### 7.2 候補者アプリ — 画面

| 画面 | 内容 |
|---|---|
| Login | メール＋パスワード。"Set a password"導線あり |
| Terms gate / Consent gate | `needsTerms` / `needsConsent`時に全画面 |
| **Home** | completenessリング、未応答の紹介、パイプラインのタイムライン |
| Intro deck | 未応答の紹介カードをスワイプ。会社名・求人・所在地・給与レンジ |
| Pipeline detail | 会社ごとの進捗。`status`と`statusNote`。マッチ済みなら"Frog will contact you" |
| Profile editor | セクション分割（Basics / Work auth / Compensation / Summary）。1画面1トピック |
| Experience / Links | 追加・編集・削除 |
| Resume | PDFアップロード（Files / iCloud Driveから選択）、プレビュー、削除 |
| Preview | 企業から見た自分。**Frog Scoreは出さない** |
| Sharing | consentのオンオフ、どの会社に共有中か、閲覧アクティビティ |
| Notifications / Settings | Inbox、通知設定、パスワード変更、ログアウト、アカウント削除導線 |

**Frog Scoreを候補者アプリのコードに一切入れないこと。** DTOにも含めない。うっかり表示されると候補者との信頼関係が壊れる。

### 7.3 スワイプの実装要件

- 自前実装。カードは`ZStack`で3枚、背面2枚はスケールとオフセットをずらす
- しきい値: 画面幅の25%を超えたらコミット。速度（`predictedEndTranslation`）も加味
- 上スワイプは高さの20%＋上向き速度で判定。左右と競合しないよう、水平移動が垂直の1.5倍未満のときだけ上スワイプとみなす
- 進行中はオーバーレイラベル（INTERESTED / PASS / INTERVIEW）を不透明度で追従
- Haptics: 右=`.success`通知フィードバック、左=`.light`インパクト、上=`.rigid`インパクト
- **アクセシビリティ**: スワイプだけにしない。カード下部に同等のボタン3つ（Pass / Later / Interested）を常時置く。VoiceOverでは`accessibilityAction`で全アクションを提供する。これはApp Store審査でも見られる
- Reduce Motionがオンなら回転とスプリングを止め、フェードにする

### 7.4 オフラインと同期

- デッキは最大20件をプリフェッチしてメモリに保持
- スワイプは即座にローカル確定させ、送信は`PendingActionQueue`に積む。送信成功で除去
- 送信はupsertなので**再送安全**。ネットワーク復帰時にまとめて流す
- 送信前の3秒間はスナックバーでUndoできる。この間はキューに入れない
- 401を受けたら1回だけrefreshして再送。それでも失敗ならログアウト

### 7.5 環境変数とモック

FrogCompassと同じ流儀:

- `FROG_RECRUIT_API_BASE` — 既定 `https://recruit.frogagent.com`
- `FROG_USE_MOCK_API=1` — `MockRecruitAPI`に切り替え。UIテストで使う
- `FROG_SKIP_ONBOARDING=1` — ゲート画面をスキップ

### 7.6 シミュレーターへの反映

`FrogCompass`の`.cursor/rules/always-deploy-simulator.mdc`と同じ運用にする。コード変更のたびにビルド→インストール→起動まで行う。`scripts/build-simulator.sh`に両アプリ分を用意する。

```bash
cd /Users/senna/src/frog-systems/frog-recruit-ios
xcodegen generate   # project.ymlを変えたときのみ
xcodebuild -project FrogRecruit.xcodeproj -scheme EmployerApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build/DerivedData build
xcrun simctl install booted "build/DerivedData/Build/Products/Debug-iphonesimulator/Frog Recruit for Employers.app"
xcrun simctl launch booted com.frogagent.recruit.employer
```

シミュレーターでのプッシュ検証は`.apns`ファイルを使う:

```bash
xcrun simctl push booted com.frogagent.recruit.employer payload.apns
```

実機のAPNs疎通は、本番Workerにデプロイしてから確認する（§6.1）。

---

## 8. セキュリティとプライバシー

| 項目 | 方針 |
|---|---|
| トークン保管 | refresh tokenのみKeychain（`AfterFirstUnlockThisDeviceOnly`）。access tokenはメモリのみ |
| 通信 | ATSデフォルト（例外を追加しない）。`NSAllowsLocalNetworking`はDebug構成のみ |
| レジュメ | アプリ内PDFKit表示のみ。共有・保存・印刷を無効化。スクショを検知して`view_audit`へ記録 |
| 通知ペイロード | ID・deepLinkのみ。PII本文は既定で出さない（§6.3） |
| 端末紛失 | adminのWeb画面から該当ユーザーの`mobile_sessions`と`device_tokens`を一括失効できるようにする（`/admin/employers`、`/admin/candidates/[id]`にボタンを追加） |
| ログ | アプリ・Worker双方で、メールアドレス・トークン・候補者名をログに出さない |
| アカウント削除 | 候補者アプリに削除導線を置く（App Store 5.1.1(v)の要件）。削除はFrogへの削除リクエスト送信＋即時ログアウトでよいが、**アプリ内に導線が存在すること**が必須 |
| 監査 | 企業アプリの全閲覧行為（`view_list` / `view_detail` / `download_resume` / `submit_feedback` / `screenshot_taken`）を`view_audit`に追記 |

---

## 9. App Store審査で詰まりそうな点

事前に手を打つ。

1. **4.3 スパム（2アプリが重複と見なされる）** — 両アプリともApp Store公開で進める（オーナー決定）。UIも対象ユーザーも別物であることをレビューノートに明記する。万一リジェクトが続く場合の退避先として、企業アプリをApple Business ManagerのCustom Appに切り替える手はある
2. **5.1.1(v) アカウント作成** — どちらのアプリもサインアップできない（Frogからの招待制）。レビューノートで説明し、**候補者用と企業用のデモアカウントを必ず提出**する。デモ企業には裁定可能な候補者カードを数枚シードしておく
3. **4.8 Sign in with Apple** — アプリにGoogleサインインを載せないことで回避する。将来Googleを載せるならSign in with Appleを同時に実装する
4. **アカウント削除** — 候補者アプリに導線必須（上記§8）
5. **料金表示** — 企業アプリに`/portal/fees`相当の紹介手数料表を**載せない**。サービス手数料の提示が外部購入導線と解釈されると3.1.1の議論になりうるため、初版では触れない。必要ならWebで見せる
6. **App Privacy（栄養ラベル）** — 候補者アプリ: 連絡先情報、職歴、ユーザーコンテンツ（履歴書）、識別子を「アプリの機能」目的で収集、トラッキングなし。企業アプリ: 識別子のみ。ATTは不要
7. **4.2 最低限の機能** — WebViewラッパーにしない。全画面ネイティブ実装＋プッシュで要件を満たす

---

## 10. フェーズ計画と受け入れ条件

### Phase 0 — バックエンドAPI層（Webリポ内、アプリ着手前）

やること: ロジックのサービス層抽出、`/api/v1`実装、`0009_mobile.sql`、`src/lib/push/apns.ts`、admin画面へのセッション失効ボタン。

受け入れ条件:
- `docs/SMOKE-TEST.md`のWeb側フローが**一切壊れていない**（Server Actionsが従来通り動く）
- curlで候補者・企業の全エンドポイントを一周できる
- 失効したgrantで`/employer/candidates/{id}`が403を返す
- consentを取り消すと`/employer/deck`からその候補者が即消える
- `buildEmployerCandidateView`のレスポンスに`internalNotesMd`とメールが含まれないことをテストで固定する
- デプロイ済みWorkerから実機にAPNsのテスト通知が届く

### Phase 1 — 企業アプリ（価値が最も大きい）

Login、Terms gate、Deck、Card detail、Resume viewer、Reviewed、Settings、`new_candidate`と`match`のプッシュ。

受け入れ条件:
- 実機でスワイプ→`candidate_feedback`に正しく入る→Web版の`/admin`で確認できる
- 機内モードでスワイプ→復帰後に自動送信される
- 権限のない候補者IDを直接叩いても403
- レジュメが透かし付きで表示され、共有シートが出ない
- VoiceOverだけで全カードを裁定できる
- パイロット企業1社にTestFlight配布

### Phase 2 — 候補者アプリ

Login、gate群、Home、Intro deck、Profile editor、Experience/Links、Resume、Preview、Sharing、`employer_interested`・`interview_request`・`intro_status_changed`のプッシュ。

受け入れ条件:
- 企業がWebまたはアプリで`interested`を押す→候補者の実機に通知が届く
- 候補者が右スワイプ→`matched_at`が入り、企業と候補者とSlackの3方向に通知
- どの画面にもFrog Scoreが出ないことをコード検索で確認
- レジュメアップロードがPDF以外を弾く

### Phase 3 — 仕上げ

Cronのダイジェストとリマインダー、アプリ内Inbox、通知設定、Undo、オフライン整備、ローカライズ（英語のみでよいが文字列を外出し）、アクセシビリティ監査。

### Phase 4 — 公開

App Store申請（レビューノート＋デモアカウント）、プライバシーポリシー更新（`/privacy`にモバイルアプリの記述を追加）、Obsidianへ作業ログ記録。

---

## 11. 決定済み事項と、未確認の事項

### 決定済み（2026-09-16オーナー確認）

| 論点 | 決定 |
|---|---|
| アプリ内チャット | **作らない。** Frogが間に立って面談を設定する。将来の拡張余地としても残さない |
| 企業アプリの配布 | **App Store公開。** 招待ユーザーのみログイン可 |
| 候補者への求人開放 | **しない。** Frogが紹介した企業への応答のみ。オープンな求人一覧は作らない |
| アプリのGoogleサインイン | **載せない。** メール＋パスワードのみ（§4.2の理由による） |

### 未確認（実装着手前に要確認）

1. **Apple Developer Program** — Team ID `9B65MF69MF`（FrogCompassと同じ）を使う前提でよいか。APNsキー(.p8)の新規発行が必要
2. **通知でのPII表示の既定** — 既定オフ（§6.3）でよいか
3. **ロゴ・アプリアイコン** — 公式Frogロゴから2アプリ分のアイコンを起こす必要がある

---

## 付録A — 既存コードの参照先

| 用途 | パス |
|---|---|
| 行レベル認可（**複製禁止**） | `src/lib/auth/grant.ts` |
| 企業向け安全DTO（**複製禁止**） | `src/lib/employer/candidate-dto.ts` |
| 企業フィードバック（抽出元） | `src/lib/employer/feedback-actions.ts` |
| 候補者アクション（抽出元） | `src/lib/candidate/actions.ts` |
| 管理者アクション（通知フック追加先） | `src/lib/admin/actions.ts` |
| ガード | `src/lib/auth/helpers.ts`, `src/lib/candidate/guard.ts`, `src/lib/employer/guard.ts` |
| パスワード(PBKDF2) | `src/lib/auth/password.ts` |
| レート制限(KV) | `src/lib/ratelimit/kv.ts` |
| 透かし | `src/lib/pdf/watermark.ts` |
| 監査 | `src/lib/audit/log.ts` |
| メール | `src/lib/email/{resend,messages}.ts` |
| Slack通知 | `src/lib/slack/notify.ts` |
| R2 | `src/lib/storage/{r2,r2-s3-proxy,magic-bytes}.ts` |
| スキーマ | `src/lib/db/schema/*` |
| マイグレーション正本 | `scripts/migrations/` |
| iOSの慣習の参考 | `/Users/senna/src/frog-systems/FrogCompass`（`project.yml`, `Support/Theme.swift`, `Support/Account.swift`） |

## 付録B — 主要enumの実値

- `users.role`: `admin` / `candidate` / `employer`
- `users.status`: `pending` / `approved` / `rejected`
- `candidate_feedback.interest`: `interested` / `maybe` / `not_interested`
- `candidate_introductions.status`: `planned` / `shared` / `interviewing` / `offer` / `hired` / `declined` / `withdrawn`
- `candidate_consents.scope`: `share_with_employers` / `share_with_company`
- `view_audit.action`: `view_list` / `view_detail` / `view_resume` / `download_resume` / `preview_pdf` / `submit_feedback`（＋新規`screenshot_taken`）
- `candidate_profiles.workAuthStatus`: `us_citizen` / `green_card` / `h1b` / `tn` / `opt` / `ca_pr` / `ca_citizen` / `iec` / `needs_sponsorship` / `other`
- `candidate_profiles.englishLevel`: `native` / `business` / `conversational` / `basic`
- `recommendations.status`: `draft` / `published`、`visibility`: `internal_only` / `shared`
