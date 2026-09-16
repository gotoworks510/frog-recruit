/**
 * Employer-facing referral fee schedule (commercial terms summary).
 * Full signed agreements may add payment-admin details; this is the rate card.
 */

export const FEE_ENTITY_NAME = "Frog Creator Production Inc.";
export const FEE_BRAND_NAME = "Frog";

/** First successful engagement of a Frog-referred person at the company. */
export const FIRST_HIRE_FEE_LABEL = "Complimentary";
export const FIRST_HIRE_FEE_PCT = 0;

/** Second and subsequent successful engagements. */
export const SUBSEQUENT_HIRE_FEE_PCT = 5;

/** Months the percentage applies to contractor gross amounts. */
export const CONTRACTOR_FEE_PERIOD_MONTHS = 12;

export type FeeTier = {
  id: string;
  title: string;
  rateLabel: string;
  detail: string;
};

export const FEE_TIERS: FeeTier[] = [
  {
    id: "first",
    title: "First hire",
    rateLabel: "Free",
    detail:
      "The first time your company engages someone Frog referred — employee or contractor — no referral fee is charged.",
  },
  {
    id: "next",
    title: "Second hire and after",
    rateLabel: `${SUBSEQUENT_HIRE_FEE_PCT}%`,
    detail:
      "Each later engagement of a Frog-referred person is billed at five percent, calculated as below.",
  },
];

export const FEE_CALCULATION_POINTS: { title: string; body: string }[] = [
  {
    title: "Employees (permanent or fixed-term)",
    body: `Referral fee = ${SUBSEQUENT_HIRE_FEE_PCT}% of first-year base compensation (excluding discretionary bonuses unless guaranteed in writing). One invoice per hire.`,
  },
  {
    title: "Independent contractors",
    body: `Referral fee = ${SUBSEQUENT_HIRE_FEE_PCT}% of the gross amount invoiced by or payable to that contractor in each calendar month during a ${CONTRACTOR_FEE_PERIOD_MONTHS}-month Fee Period starting on their first day of services. No fee after the Fee Period ends.`,
  },
  {
    title: "When it is due",
    body: "Fees apply only if you engage a person Frog identified in writing (including email). No hire, no fee. Invoices are typically issued on start / first service date, payable Net 30, plus applicable tax.",
  },
  {
    title: "Who pays",
    body: "Employers pay Frog. Candidates are never charged for introductions — that is how recruitment works in British Columbia.",
  },
];

export const FEE_SCOPE_POINTS: string[] = [
  "Frog's role is introducing people and supporting the relationship — not employing the candidate or performing their work.",
  "The working relationship (employment or contractor services) is between your company and the person you engage.",
  "Referral fees are in addition to amounts you pay the hire; they do not reduce what the person receives.",
  "Counts are per company: one complimentary first engagement with Frog, then five percent on later Frog-referred engagements.",
];
