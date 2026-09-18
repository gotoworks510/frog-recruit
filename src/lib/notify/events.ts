/**
 * Notification event catalog (source of truth).
 *
 * Push copy is English only and must NEVER contain a candidate name, salary,
 * Frog Score, or internal notes — push bodies show on the lock screen.
 * See docs/IPHONE-APP-SPEC-PROMPT-FABLE.md §7.1 and
 * docs/IPHONE-APP-OWNER-DECISIONS.md §4 (owner override: employer.viewed OFF).
 */

export const NOTIFICATION_KINDS = [
  "candidate.introduced",
  "introduction.created",
  "introduction.updated",
  "candidate.resume_updated",
  "grant.expiring",
  "employer.interested",
  "employer.viewed",
  "frog.message",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationAudience = "employer" | "candidate";

export interface NotificationKindMeta {
  kind: NotificationKind;
  /** Roles that can ever receive this kind (drives the preferences list). */
  audience: NotificationAudience[];
  /** Default when the user has no notification_preferences row. */
  defaultPushEnabled: boolean;
  /** Preferences screen label (English). */
  label: string;
  /** Preferences screen description (English). */
  description: string;
}

export const NOTIFICATION_CATALOG: Record<
  NotificationKind,
  NotificationKindMeta
> = {
  "candidate.introduced": {
    kind: "candidate.introduced",
    audience: ["employer"],
    defaultPushEnabled: true,
    label: "New candidate introduced",
    description: "Frog introduces a new candidate to your team.",
  },
  "introduction.created": {
    kind: "introduction.created",
    audience: ["candidate"],
    defaultPushEnabled: true,
    label: "New introduction",
    description: "Frog introduces you to a company.",
  },
  "introduction.updated": {
    kind: "introduction.updated",
    audience: ["candidate", "employer"],
    defaultPushEnabled: true,
    label: "Introduction updates",
    description: "An introduction moves to a new stage.",
  },
  "candidate.resume_updated": {
    kind: "candidate.resume_updated",
    audience: ["employer"],
    defaultPushEnabled: true,
    label: "Resume updated",
    description: "A candidate you are reviewing uploads a new resume.",
  },
  "grant.expiring": {
    kind: "grant.expiring",
    audience: ["employer"],
    defaultPushEnabled: true,
    label: "Access expiring",
    description: "Your access to a candidate is about to end.",
  },
  "employer.interested": {
    kind: "employer.interested",
    audience: ["candidate"],
    defaultPushEnabled: true,
    label: "Company interest",
    description: "A company wants to move forward with your introduction.",
  },
  "employer.viewed": {
    kind: "employer.viewed",
    audience: ["candidate"],
    // Owner decision 2026-09-16: a view is not progress — push is OFF by
    // default. The event still lands in the in-app Inbox.
    defaultPushEnabled: false,
    label: "Profile views",
    description: "A company opens your profile. Off by default.",
  },
  "frog.message": {
    kind: "frog.message",
    audience: ["candidate", "employer"],
    defaultPushEnabled: true,
    label: "Messages from Frog",
    description: "Direct messages from your Frog representative.",
  },
};

export function isNotificationKind(v: string): v is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(v);
}

/** Kinds a given role can receive (for the preferences screen). */
export function kindsForAudience(
  audience: NotificationAudience
): NotificationKindMeta[] {
  return NOTIFICATION_KINDS.map((k) => NOTIFICATION_CATALOG[k]).filter((m) =>
    m.audience.includes(audience)
  );
}

export function defaultPushEnabled(kind: NotificationKind): boolean {
  return NOTIFICATION_CATALOG[kind].defaultPushEnabled;
}
