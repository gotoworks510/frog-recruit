# Frog Recruit iOS — オーナー確定事項（2026-09-16）

> `IPHONE-APP-SPEC-PROMPT-FABLE.md` を正本とし、本ファイルの行が **矛盾する場合は本ファイルが優先**。
> 実装・契約・受け入れはここを前提にする。

---

## 1. プロダクト前提

Frog が候補者を登録し企業へ紹介する時点で、次は **既に確認済み** とする。

1. 当該企業への情報共有を候補者が許容している（仲介前提の共有）。
2. 当該企業／紹介に対して候補者側の関心が取れている。

そのためアプリは「初対面のマッチング」ではなく、**Frog 仲介の紹介パイプラインをモバイルで進める UI** とする。双方の関心一致は Frog の業務支援に使い、ユーザーには **調整状況（coordination status）** を伝える（マッチ成立の祝祭 UI は作らない）。

---

## 2. 候補者の返答（§3-H 上書き）

紹介カードへの反応は **3 値**:

| 値 | 日本語（社内） | 英語 UI |
|---|---|---|
| `interested` | 興味あり | I'm interested |
| `consult` | 相談 | Talk to Frog first |
| `pass` | 見送り | Pass for now |

- DB: `candidate_introductions.candidate_response` ∈ 上記。
- 変更可（最終値を保持。`candidate_responded_at` は毎回更新）。
- 企業へは **直接通知しない**。Frog へ Slack（＋必要なら Inbox は admin のみ）。
- `pass` でも intro status は自動で `declined` にしない（Frog が判断）。

---

## 3. 企業ホーム（§8.1–8.3 上書き）

初期タブは **Home**（Discover デッキ単独ではない）。

1. **Action needed** — 未評価の紹介（`myFeedback == null`、有効 grant）。
2. **In progress** — 評価済みまたは intro status ∈ `{interviewing, offer, …}` の進行中。

スワイプ（Interested / Maybe / Pass）は **確認手段の一つ**（Action needed からのショートカット／デッキモード）。一覧・詳細・ボトムシートと等価。

カード表面に必ず出す情報:

- Frog の推薦理由（strengths 抜粋）
- 対象職種（intro / job title。無ければ headline）
- 重要な確認事項（considerations 抜粋、または work auth / location の注意）

氏名は詳細・一覧では可。カード表面は職能優先（Fable §8.3 既定を維持可）。

---

## 4. 通知（§3-I / §7 / §13 上書き）

| 項目 | 決定 |
|---|---|
| `employer.viewed` Push 既定 | **OFF**（閲覧は前進を意味しない。期待・不安だけ増えうる） |
| 閲覧履歴 | アプリ内 Activity / Inbox には残してよい（Push しないだけ） |
| Push の中心 | 紹介・返答依頼・面談・進捗変更 |
| 通知タップ | **v1 から** `data.route` / `data.id` で対象画面へ直接遷移 |
| 「30 秒以内に実機 Push」 | **管理された試験環境の目標**。一般環境の到達保証にはしない。Expo の配送レシート成功 ≠ 端末受信 |

---

## 5. 認証・セルフサービス（§3-D / §15-4 補足）

- アプリ認証は **credentials（email + password）のみ**（Fable 維持）。
- Web と同じゲート: mustReset → terms →（候補者）consent。
- **セルフサービス**を v1 API に含める（管理者の仮パス再発行待ちを減らす）:
  - `POST /auth/password-reset/request` `{ email, appVariant }` — 常に同一応答（列挙防止）。credentials ユーザーのみトークン発行＋メール。
  - `POST /auth/password-reset/confirm` `{ token, newPassword }` — 成功後に全 `mobile_sessions` 失効。
- アカウント新規作成自体は招待／admin 発行のまま（公開サインアップはしない）。

同意（`share_with_employers`）は法務・実行時認可のため残す。ただし §1 の前提により、Frog 登録済み紹介は「初めて知る企業へのオプトイン」ではない。revoke 時の見え方は §6。

---

## 6. 同意撤回と候補者 API（§6.1–6.2 / §9.2）

`consentActive === false` でも **Home は表示する**（「Your profile is hidden from all employers」バナー必須）。

| 操作 | consent 無しで許可 |
|---|---|
| `GET /me`, `GET /candidate/home` | ✅ |
| `GET/PUT` notifications・preferences・devices | ✅ |
| `POST /account/password`, terms, deletion-request | ✅ |
| `POST /candidate/consent` | ✅ |
| `GET /candidate/introductions` 相当（home 内） | ✅ 読み取り |
| `POST .../introductions/:id/response` | ✅（Frog へ意思表示。企業には届かない） |
| Profile / Experience / Links / Resume / Preview の読取 | ✅（自分のデータ） |
| 同上の **変更**（PATCH/POST/DELETE） | ❌ `409 gate_required gate=consent` |
| Employer 向け可視性 | 既存 `getEffectiveGrant` どおり即時不可視 |

---

## 7. 再紹介・複数担当・返答変更・共有停止（実装前定義）

| 事象 | 定義 |
|---|---|
| **再紹介** | 同一 `(candidate, company)` の intro 行は 1 つ（UNIQUE）。status を `shared` 等へ戻す／更新する。新規 intro 行は作らない。`candidate_response` は Frog がクリアしない限り保持。企業の `candidate_feedback` は担当者ユーザー単位（下記）。再 shared 時は `syncCandidateVisibility` → dedupe は `grantId:grantedAt` のため **grant 再活性で grantedAt が変われば** 新通知可。 |
| **複数担当者** | `access_grants` は employer **user** 単位。同一会社の複数ユーザーが各自フィードバック可。候補者への `employer.interested` は **会社単位 dedupe**（既存仕様）。企業 Home の「自分の要対応」は **当該ユーザーの未評価**。 |
| **返答変更** | 企業 feedback / 候補者 response とも upsert で上書き可。`newlyInterested` 副作用は **interested への初回遷移のみ**。オフライン競合は §9。 |
| **共有停止** | 候補者 revoke consent → 全企業から即時不可視。企業側 API は 403／一覧除外。候補者 Home は §6。admin の grant revoke は当該企業ユーザーのみ。 |

---

## 8. Refresh token 再利用検知（§5 / §6.2 明確化）

`mobile_sessions` 1 行 = 1 端末セッション。ローテーションと再利用検知の関係:

| 列 | 意味 |
|---|---|
| `refresh_token_hash` | **現在だけ**有効な refresh の SHA-256 |
| `previous_token_hash` | 直前のローテで退いた hash |
| `previous_grace_until` | previous を「並行 refresh」として許す期限（ローテ時点 + 60s） |

**正規ローテ:** 提示 hash == current → `previous = old current`、新 random を current に、`previous_grace_until = now+60s`。レスポンスは新 access + 新 refresh。クライアントは **必ずレスポンスの refresh で SecureStore を上書き**。アプリ側は refresh を single-flight（mutex）する。

**並行救済:** 提示 hash == previous かつ `now < previous_grace_until` → セッションは殺さない。current を再度ローテし（`previous_token_hash` は **最初に退いた hash のまま**、grace は延長しない）、新 access + 新 refresh を返す。同じ古いトークンの再送は grace 内なら成功し続ける。

**再利用検知:** 次のいずれか → 当該 user の全 `mobile_sessions` を `reuse_detected` で失効し、push token 削除、Slack 警告。

1. previous 提示だが grace 期限切れ
2. 既に `revoked_at` 済みのセッションがかつて持っていた hash の再提示（current / previous いずれかの履歴）

**未知トークン** → 401（本文一様）。パスワード変更・admin 無効化は §7.5 どおり `password_changed` / `admin` 等で失効（reuse ではない）。

---

## 9. オフライン送信の安全性（§8.3 上書き）

`PUT` upsert だけでは不十分。フィードバック／候補者返答は:

```json
{
  "interest": "interested",
  "...": "...",
  "clientRequestId": "uuid",          // 必須。同一 ID の再送は副作用なしで同一結果
  "baseUpdatedAt": "ISO-8601|null"    // 既知のサーバ updatedAt。不一致なら 409 conflict
}
```

- `client_request_id` を `candidate_feedback` / intro response に保存（UNIQUE per employer-feedback or per intro）。同一 ID 再送 → 現在行を返す（メール／Push／Slack 再送なし）。
- `baseUpdatedAt` がサーバより古い → `409 { error: "conflict", current }`。クライアントはマージ UI。
- Inbox / Push の dedupe は既存 `notifications.dedupe_key`。

---

## 10. 実装順序（変更なし）

Fable §13: **Phase 0（API + 通知）完了後**にアプリ UI。本決定は Phase 0 の契約・スキーマに反映してから Phase 1 へ進む。

---

## 11. 運用タスクの担当分け（2026-09-16 追記）

エージェントが実行可能なもの（資格情報がリポ隣接 `.env` / wrangler にある前提）:

- `MOBILE_JWT_SECRET` の生成と `wrangler secret put`
- 本番／DEV D1 への `0009_mobile.sql` 適用
- `/forgot-password`・`/reset-password` Web UI
- コードのデプロイ（`npm run deploy`）

オーナー（人間）が必要なものだけ:

- **Apple Developer 組織アカウント**（D-U-N-S・契約）と App Store Connect アプリ作成
- **APNs Auth Key (.p8)** の発行と EAS credentials への登録（Apple ポータル操作）
- Expo / EAS への初回ログイン（ブラウザ OAuth）。以後 `eas init`・Build はエージェント可
- （任意）Expo ダッシュボードで発行する `EXPO_ACCESS_TOKEN` — Push はトークン無しでも動くがレート緩和用
