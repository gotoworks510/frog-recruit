/**
 * App Store listings for the two Frog Recruit iPhone apps.
 * ASC: candidate 6812968612 · employer 6812968390
 */
export const APP_STORE = {
  candidate: {
    id: "6812968612",
    name: "Frog Recruit",
    subtitle: "Introductions from Frog",
    audience: "Candidates",
    blurb:
      "See introductions Frog is coordinating, respond when asked, and keep your profile and resume ready.",
    url: "https://apps.apple.com/app/frog-recruit/id6812968612",
  },
  employer: {
    id: "6812968390",
    name: "Frog Recruit for Employers",
    subtitle: "Review Frog introductions",
    audience: "Hiring teams",
    blurb:
      "Review candidates Frog granted you, read Frog's perspective, and mark Interested or Pass from your iPhone.",
    url: "https://apps.apple.com/app/frog-recruit-for-employers/id6812968390",
  },
} as const;

export type AppStoreVariant = keyof typeof APP_STORE;
