# frog-recruit — スモークテスト手順

ローカル（`npm run dev` → http://localhost:3005）または本番デプロイ後に、3者の主要フローを通しで確認する。

## 事前準備（ローカル）

1. `.env.local` を `.env.example` から作成し、`GOOGLE_CLIENT_ID/SECRET`・`NEXTAUTH_SECRET`・`RESEND_API_KEY`・`CLOUDFLARE_ACCOUNT_ID`・`CLOUDFLARE_API_TOKEN`・`DEV_D1_DATABASE_ID`・`R2_ACCESS_KEY_ID/SECRET` を設定。`ADMIN_EMAILS` に自分の Google アドレスを入れる。
2. `npm run db:setup`（DEV D1 にスキーマ + Palm seed）。
3. `npm run dev`。

## フロー

### A. 管理者（Frog スタッフ）
- [ ] `/login` から Google サインイン（`ADMIN_EMAILS` のアドレス）→ `/admin` に到達。
- [ ] `/admin/companies` に Palm が表示される（seed 済）。求人「Senior Backend Engineer / 175,000–190,000 USD」も。

### B. 招待制ゲート
- [ ] `/admin/invites` でテスト候補者のメール（**B で使う別 Google アドレス**）を招待 → 招待メールが `recruit@japan.frogagent.com` から届く（またはコンソール/Resend ダッシュボードで確認）。
- [ ] 招待 URL を**別の**（未招待の）Google アカウントで開いてサインイン → **拒否**される（`/login?error=AccessDenied`）。
- [ ] 招待 URL を**招待先と同じ**メールの Google でサインイン → `/consent` → 同意 → `/me`。

### C. 候補者プロフィール
- [ ] `/me/profile` で職種・サマリー・就労資格・希望年収を保存。
- [ ] `/me/experience` で職歴を追加。`/me/links` で LinkedIn を追加。
- [ ] `/me/resume` で **PDF** をアップロード（非PDFは拒否されることも確認）。
- [ ] `/me/preview` が「企業に見える内容」を表示（この時点では推薦は未公開のため出ない）。

### D. 管理者キュレーション
- [ ] `/admin/candidates/<userId>` で推薦ポイント・留意点・社内メモを入力 → ステータス「公開」+ 公開範囲「企業に共有」で保存。
- [ ] 同ページ下部の「企業に見える内容（プレビュー）」に推薦が反映。社内メモは出ない。

### E. 企業アカウント & 権限
- [ ] `/admin/employers` で Palm の企業アカウントを発行（メール＋仮パスワードが画面に一度表示＋メール送信）。
- [ ] `/admin/grants` で「Palm の企業アカウント × 候補者」に権限付与。**候補者が未同意なら付与は拒否**されることも確認（/me/sharing で一旦停止 → 付与拒否 → 再開 → 付与成功）。

### F. 企業ビュー（別ブラウザ/シークレット推奨）
- [ ] `/employer/login` で発行されたメール＋仮パスワードでログイン → 初回は**パスワード変更**へ誘導 → 変更後 `/portal`。
- [ ] `/portal` に**権限付与された候補者のみ**表示。詳細で推薦ポイント・留意点が見える。社内メモは出ない。
- [ ] レジュメを開くと **PDF に「Palm ・ <メール> ・ <日時> ・ CONFIDENTIAL」の透かし**が入る。
- [ ] 未付与の候補者 ID を直接 URL で開く → **404/403**。

### G. 失効・取り消し
- [ ] `/admin/grants` で権限を失効 → 企業側で当該候補者が**即座に閲覧不可（403/一覧から消える）**。
- [ ] 候補者が `/me/sharing` で共有停止 → 企業の閲覧が**即停止**。
- [ ] `/admin/audit` に閲覧・DL の履歴が記録されている。

### H. セキュリティ確認
- [ ] `curl -I http://localhost:3005/` に `X-Robots-Tag: noindex...` / CSP / `X-Frame-Options: DENY` が付く。
- [ ] 企業ログインを誤パスワードで連打 → （本番/KV 有効時）11回目以降 429。

## デプロイ後（本番）

- [ ] LP が 200 + noindex。
- [ ] 実 Google で admin ログイン。
- [ ] 実候補者を招待 → メール到達（`recruit@japan.frogagent.com`）。
- [ ] 企業アカウント発行 → ログイン → 透かしレジュメ → 監査記録。
