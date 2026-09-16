/** Fictional data only — for /demo screenshots and the how-it-works guide. */

export const DEMO_COMPANY = {
  name: "Harborline Analytics",
  blurb:
    "A product analytics company helping ecommerce brands understand merchandising performance. Fictional company used only for product demos.",
  role: "Software Engineer (Platform) — Contractor",
  location: "Full remote · North America timezone",
};

export const DEMO_CANDIDATES = [
  {
    id: "demo-alex",
    displayName: "Alex Rivera",
    firstName: "Alex",
    headline: "Backend engineer · TypeScript / PostgreSQL",
    yearsExperience: 7,
    workAuth: "IEC (Canada)",
    locationPreference: "Vancouver / remote",
    frogScore: 8.5,
    excerpt:
      "Strong ownership of production services, clear TypeScript depth, and a calm communication style that fits a small remote team.",
    strengths: [
      "Ships full-stack TypeScript services with PostgreSQL and AWS in production.",
      "Comfortable owning ambiguous tickets end-to-end without heavy hand-holding.",
      "Already authorized to work in Canada on IEC — no sponsorship required.",
    ],
    considerations: [
      "Less ecommerce domain experience so far — expect a short ramp on product context.",
      "Prefers async-first collaboration; confirm timezone overlap expectations early.",
    ],
  },
  {
    id: "demo-mika",
    displayName: "Mika Chen",
    firstName: "Mika",
    headline: "Full-stack engineer · Node.js / React",
    yearsExperience: 5,
    workAuth: "IEC (Canada)",
    locationPreference: "Remote (PT overlap)",
    frogScore: 7,
    excerpt:
      "Solid product engineer with clean delivery habits. A dependable mid-level hire for platform maintenance and feature work.",
    strengths: [
      "Balanced frontend and backend experience on Node.js and React.",
      "Good written English and structured status updates.",
    ],
    considerations: [
      "Fewer years leading architecture decisions — best paired with a senior owner.",
    ],
  },
  {
    id: "demo-jordan",
    displayName: "Jordan Blake",
    firstName: "Jordan",
    headline: "Software engineer · Backend leaning",
    yearsExperience: 4,
    workAuth: "Needs Sponsorship",
    locationPreference: "Open to relocate",
    frogScore: 4,
    excerpt:
      "Capable engineer on paper, but sponsorship needs and shorter runway make this a secondary option for this mandate.",
    strengths: [
      "Core backend skills overlap the role requirements.",
    ],
    considerations: [
      "Would require visa sponsorship for longer-term employment.",
      "Deprioritize unless the team explicitly wants a sponsored hire path.",
    ],
  },
] as const;

export const DEMO_CANDIDATE_HOME = {
  firstName: "Alex",
  completeness: 100,
  companyName: DEMO_COMPANY.name,
  companyBlurb: DEMO_COMPANY.blurb,
  roleTitle: DEMO_COMPANY.role,
  roleLocation: DEMO_COMPANY.location,
  introStatus: "Shared with company",
};
