// 中央連絡停止リスト（mailsystem のグローバル opt-out）との突合（Worker 版）。
// mailsystem の email_suppressions が「金輪際メールを送らない」真実源。
// この Worker からは export エンドポイントを fetch して参照する。KV は無いので
// モジュール変数で 5 分メモ化（Worker isolate 内で再利用）。取得失敗時は直近の
// メモ（無ければ空集合）にフォールバックする。
// 認証は Worker secret CRS_INGEST_SECRET（mailsystem と同一値）。

const EXPORT_URL =
  process.env.MAILSYSTEM_SUPPRESSION_URL ||
  "https://mailsystem.frog-school.com/api/public/suppressions/export";
const TTL_MS = 5 * 60 * 1000;

let memo: { at: number; set: Set<string> } | null = null;

export async function getCentralSuppressed(): Promise<Set<string>> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.set;
  const secret = process.env.CRS_INGEST_SECRET;
  if (!secret) {
    console.warn("[central-suppression] CRS_INGEST_SECRET 未設定 — 参照不可");
    return memo?.set ?? new Set();
  }
  try {
    const res = await fetch(EXPORT_URL, { headers: { Authorization: `Bearer ${secret}` } });
    if (res.ok) {
      const data = (await res.json()) as { emails?: string[] };
      const set = new Set((data.emails || []).map((e) => e.trim().toLowerCase()));
      memo = { at: Date.now(), set };
      return set;
    }
    console.warn(`[central-suppression] export HTTP ${res.status}`);
  } catch (e) {
    console.warn(`[central-suppression] 取得失敗: ${(e as Error).message}`);
  }
  return memo?.set ?? new Set(); // フォールバック（可用性優先で fail-open）
}

export async function isCentrallySuppressed(email: string): Promise<boolean> {
  if (!email) return false;
  return (await getCentralSuppressed()).has(email.trim().toLowerCase());
}
