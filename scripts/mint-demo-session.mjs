/**
 * One-off: mint Auth.js session JWTs for demo screenshot users.
 * Usage: node --env-file=.env.local scripts/mint-demo-session.mjs candidate|employer
 */
import { encode } from "@auth/core/jwt";
import { writeFileSync } from "fs";

const role = process.argv[2] === "employer" ? "employer" : "candidate";
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) {
  console.error("AUTH_SECRET missing");
  process.exit(1);
}

const users = {
  candidate: {
    id: "u-demo-candidate",
    email: "demo.candidate@example.com",
    name: "Yuki Tanaka",
    role: "candidate",
    status: "approved",
    companyId: null,
    privacyConsentedAt: Date.now(),
  },
  employer: {
    id: "u-demo-employer",
    email: "demo.employer@example.com",
    name: "Alex Hiring",
    role: "employer",
    status: "approved",
    companyId: "co-demo-acme",
    privacyConsentedAt: null,
  },
};

const u = users[role];
const token = await encode({
  token: {
    sub: u.id,
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    companyId: u.companyId,
    privacyConsentedAt: u.privacyConsentedAt,
  },
  secret,
  salt: "authjs.session-token",
  maxAge: 60 * 60,
});

const out = {
  cookieName: "authjs.session-token",
  token,
  role,
  email: u.email,
};
writeFileSync(
  `tmp/design-shots/session-${role}.json`,
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify(out));
