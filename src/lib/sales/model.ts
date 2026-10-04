import { z } from "zod";
import { SUBSEQUENT_HIRE_FEE_PCT, CONTRACTOR_FEE_PERIOD_MONTHS } from "../employer/fee-schedule";

export const STAGES = { research: "調査・関係づくり", ready: "初回案を確認", contacted: "返信待ち", needs_received: "求人を受領", qualifying: "条件を確認", searching: "紹介可能性を検討", introduction: "既存の推薦へ接続", later: "時期未定", closed: "終了", stopped: "連絡停止" } as const;
export const KINDS = { note: "調査・メモ", draft: "下書き", sent: "初回送信の記録", followup: "追送の記録", reply: "返信", needs: "求人受領", review: "条件・紹介可能性の検討", handoff: "推薦へ接続", stop: "拒否・停止", reopen: "相手からの再開依頼" } as const;
export const REASONS = { "": "未分類", interested: "関心あり", role_received: "求人を受領", timing: "採用時期", no_need: "現在ニーズなし", mismatch: "条件不一致", wrong_contact: "担当者違い", no_reply: "無反応", declined: "紹介を辞退", unsubscribe: "停止希望", bounce: "不達", other: "その他" } as const;
export const TEMPLATE_VERSION = "story-v2-2026-10-04";
export const STORIES_URL = "https://en.frogagent.com/stories/";
export const VIDEO_URL = "https://youtu.be/deoQzsA3HRY";
export const safeUrl = z.string().trim().max(2000).refine((v) => { if (!v) return true; try { const u = new URL(v); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }, "http/https のURLを入力してください");
export const dateOnly = z.string().refine((s) => { try { return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) === s; } catch { return false; } }, "日付を確認してください");
export function normalizeDomain(value: string): string {
  const u = new URL(value.includes("://") ? value : `https://${value}`);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || !u.hostname.includes(".")) throw new Error("企業ドメインを確認してください");
  return u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}
export const prospectInput = z.object({
  companyName: z.string().trim().min(1).max(200), companyId: z.string().max(100).default(""),
  domain: z.string().trim().min(1).max(253).transform(normalizeDomain),
  jobId: z.string().max(100).default(""), jobUrl: safeUrl,
  contactName: z.string().trim().max(200), contactRole: z.string().trim().max(200),
  contactEmail: z.union([z.literal(""), z.string().trim().email().max(320)]), contactSourceUrl: safeUrl,
  contactBasis: z.string().trim().max(3000), stage: z.enum(Object.keys(STAGES) as [keyof typeof STAGES, ...(keyof typeof STAGES)[]]),
  owner: z.string().trim().max(200), nextAction: z.string().trim().max(500), dueDate: z.union([z.literal(""), dateOnly]),
  openingLine: z.string().trim().max(500), needs: z.string().trim().max(6000),
});
export const activityInput = z.object({
  kind: z.enum(Object.keys(KINDS) as [keyof typeof KINDS, ...(keyof typeof KINDS)[]]),
  summary: z.string().trim().min(1).max(3000), sourceUrl: safeUrl,
  reason: z.enum(Object.keys(REASONS) as [keyof typeof REASONS, ...(keyof typeof REASONS)[]]),
  templateVersion: z.string().trim().max(100), minutes: z.coerce.number().int().min(0).max(1440),
  occurredOn: dateOnly, approved: z.boolean(),
});
export function addBusinessDays(day: string, count: number) {
  const d = new Date(`${day}T00:00:00Z`);
  while (count > 0) { d.setUTCDate(d.getUTCDate()+1); if (![0,6].includes(d.getUTCDay())) count--; }
  return d.toISOString().slice(0,10);
}
export function storyDraft(openingLine: string, name = "[First name]") {
  return `Subject: A community-led introduction to your next hire — Frog\n\nHi ${name || "[First name]"},\n\n${openingLine || "[One verified sentence connecting your hiring needs with Frog.]"}\n\nFor 12 years, Frog has supported Japanese professionals building careers in the US and Canada. Our community has grown to more than 700 people, with members working at major technology companies, startups and mid-sized businesses. Their stories: ${STORIES_URL}\n\nOur mission has always been to help people from Japan take their skills and commitment abroad. As AI changes how we work, we believe ownership, reliability and following through matter more than ever, alongside technical ability. These are qualities we have seen in people we know through our community; we assess each person individually.\n\nRecruitment supports that wider mission rather than being our core business. Your company's first hire through Frog carries no referral fee. Later hires follow our ${SUBSEQUENT_HIRE_FEE_PCT}% schedule: first-year base compensation for employees, or monthly gross contractor compensation for the first ${CONTRACTOR_FEE_PERIOD_MONTHS} months.\n\nThis video explains how our introductions work: ${VIDEO_URL}\n\nIf this resonates, would you share a current job description or the kind of person your team needs? We will take the search seriously, explore our community and tell you candidly whether we can recommend someone who fits.\n\nBest,\nSenna [full name]\nFrog Creator Production Inc.\n[valid mailing address]\n[reply contact]\nIf you prefer no further messages from Frog Recruit, reply "unsubscribe".`;
}
export function followupDraft() {
  return `Hi [First name],\n\nFollowing up on my note about Frog's community and your hiring needs. If our approach resonates, would you share a current job description or your key requirements? We can then explore whether someone in our community could be a fit. If the timing is not right, I'll leave it here.\n\n[Same complete signature and unsubscribe instruction]`;
}
