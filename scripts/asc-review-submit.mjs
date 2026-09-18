#!/usr/bin/env node
/**
 * App Store Connect API helper: inspect versions, set review notes, submit.
 * Secrets are read from env/files and NEVER printed.
 *
 * Usage:
 *   node scripts/asc-review-submit.mjs status
 *   node scripts/asc-review-submit.mjs set-notes
 *   node scripts/asc-review-submit.mjs submit
 *   node scripts/asc-review-submit.mjs all
 */
import { readFileSync, existsSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

const ASC = "https://api.appstoreconnect.apple.com/v1";
const APPS = {
  candidate: {
    id: "6812968612",
    name: "Frog Recruit (Candidate)",
    bundle: "com.frogagent.recruit",
    video: "https://youtu.be/l3bixyy3ZV8",
  },
  employer: {
    id: "6812968390",
    name: "Frog Recruit for Employers",
    bundle: "com.frogagent.recruit.employer",
    video: "https://youtu.be/F9XBP1e9NXQ",
  },
};

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function parseCreds(path) {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  let section = null;
  const creds = { candidate: {}, employer: {} };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s+Employer/i.test(line)) section = "employer";
    else if (/^##\s+Candidate/i.test(line)) section = "candidate";
    if (!section) continue;
    const em = line.match(/^Email:\s*(.+)$/i);
    const pw = line.match(/^Password:\s*(.+)$/i);
    if (em) creds[section].email = em[1].trim();
    if (pw) creds[section].password = pw[1].trim();
  }
  if (!creds.candidate.password || !creds.employer.password) {
    throw new Error("Could not parse demo passwords from secrets file");
  }
  return creds;
}

function buildReviewNotes(kind, password) {
  if (kind === "candidate") {
    return `ACCESS
This app is invitation-only. Frog (Frog Creator Production Inc.) issues candidate accounts after review. There is no self-serve registration.

Demo account (fictional data, is_test=1 — no real PII):
Email: appreview+candidate@frogagent.com
Password: ${password}

HOW TO REVIEW
1. Sign in with the demo account.
2. Accept Terms if prompted (pre-accepted on demo).
3. Home shows fictional introductions coordinated by Frog.
4. Profile / Experience / Resume tabs show editable candidate materials.
5. Account → Request account deletion demonstrates Guideline 5.1.1(v).

WHY TWO APPS
“Frog Recruit” is for candidates. “Frog Recruit for Employers” is a separate product for hiring teams (different UX, privacy label, and notification copy). They are not duplicates (Guideline 4.3).

SIGN IN WITH APPLE
Not applicable — we do not offer third-party social login in the apps (email/password only).

DEMO VIDEO
https://youtu.be/l3bixyy3ZV8`;
  }
  return `ACCESS
Invitation-only. Frog issues employer accounts when we have a strong candidate fit. No self-serve registration.

Demo account (fictional company & candidates):
Email: appreview+employer@frogagent.com
Password: ${password}
Company: Harborline Analytics (fictional)

HOW TO REVIEW
1. Sign in.
2. Home / Review: three fictional candidates (Alex Rivera, Mika Chen, Jordan Blake) with Frog recommendations.
3. Open a candidate → view detail → optional watermarked resume.
4. Mark Interested or Pass — Frog is notified (email + Slack + candidate Inbox/push on first Interested).
5. Account → Request account deletion for Guideline 5.1.1(v).

FEES
Referral fee schedules are intentionally NOT shown in the app (discussed offline with Frog). Avoids Guideline 3.1.1 confusion.

WHY TWO APPS
Separate candidate vs employer products (see candidate app notes). Different audiences and privacy disclosures.

DEMO VIDEO
https://youtu.be/F9XBP1e9NXQ`;
}

async function mintToken(keyId, issuerId, p8Path) {
  const pem = readFileSync(p8Path, "utf8");
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuerId)
    .setIssuedAt(now)
    .setExpirationTime(now + 20 * 60)
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

async function api(token, method, path, body) {
  const res = await fetch(`${ASC}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, ok: res.ok, json };
}

function redactErrors(json) {
  if (!json?.errors) return json;
  return {
    errors: json.errors.map((e) => ({
      status: e.status,
      code: e.code,
      title: e.title,
      detail: e.detail,
      source: e.source,
    })),
  };
}

async function getAppVersions(token, appId) {
  return api(
    token,
    "GET",
    `/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10&include=build,appStoreVersionLocalizations`,
  );
}

async function getVersionDetail(token, versionId) {
  return api(
    token,
    "GET",
    `/appStoreVersions/${versionId}?include=build,appStoreVersionLocalizations,appStoreReviewDetail,appStoreVersionSubmission`,
  );
}

async function getReviewDetail(token, versionId) {
  return api(token, "GET", `/appStoreVersions/${versionId}/appStoreReviewDetail`);
}

async function getLocalizations(token, versionId) {
  return api(
    token,
    "GET",
    `/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=10`,
  );
}

async function getScreenshotSets(token, localizationId) {
  return api(
    token,
    "GET",
    `/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?include=appScreenshots&limit=20`,
  );
}

async function getAgeRating(token, versionId) {
  return api(
    token,
    "GET",
    `/appStoreVersions/${versionId}/ageRatingDeclaration`,
  );
}

async function getAppInfo(token, appId) {
  return api(
    token,
    "GET",
    `/apps/${appId}/appInfos?include=appInfoLocalizations&limit=5`,
  );
}

async function getBuilds(token, appId) {
  return api(
    token,
    "GET",
    `/builds?filter[app]=${appId}&sort=-uploadedDate&limit=5&fields[builds]=version,uploadedDate,processingState,expirationDate`,
  );
}

async function ensureReviewDetail(token, versionId, notes, contact) {
  const existing = await getReviewDetail(token, versionId);
  const attrs = {
    notes,
    demoAccountName: contact.email,
    demoAccountPassword: contact.password,
    demoAccountRequired: true,
    contactFirstName: contact.firstName || "Senna",
    contactLastName: contact.lastName || "Frog",
    contactEmail: contact.contactEmail || "info@frogagent.com",
    contactPhone: contact.phone || "+1-604-000-0000",
  };

  if (existing.ok && existing.json?.data?.id) {
    const id = existing.json.data.id;
    return api(token, "PATCH", `/appStoreReviewDetails/${id}`, {
      data: {
        type: "appStoreReviewDetails",
        id,
        attributes: attrs,
      },
    });
  }

  // Create linked to version
  return api(token, "POST", `/appStoreReviewDetails`, {
    data: {
      type: "appStoreReviewDetails",
      attributes: attrs,
      relationships: {
        appStoreVersion: {
          data: { type: "appStoreVersions", id: versionId },
        },
      },
    },
  });
}

async function createReviewSubmission(token, appId) {
  // Modern API: reviewSubmissions
  const create = await api(token, "POST", `/reviewSubmissions`, {
    data: {
      type: "reviewSubmissions",
      attributes: { platform: "IOS" },
      relationships: {
        app: { data: { type: "apps", id: appId } },
      },
    },
  });
  return create;
}

async function addSubmissionItem(token, submissionId, versionId) {
  return api(token, "POST", `/reviewSubmissionItems`, {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: {
          data: { type: "reviewSubmissions", id: submissionId },
        },
        appStoreVersion: {
          data: { type: "appStoreVersions", id: versionId },
        },
      },
    },
  });
}

async function submitReviewSubmission(token, submissionId) {
  return api(token, "PATCH", `/reviewSubmissions/${submissionId}`, {
    data: {
      type: "reviewSubmissions",
      id: submissionId,
      attributes: { submitted: true },
    },
  });
}

function pickVersion100(versionsJson) {
  const list = versionsJson?.data || [];
  const v100 = list.find((v) => v.attributes?.versionString === "1.0.0");
  return v100 || list[0] || null;
}

async function inspectApp(token, key, meta) {
  const report = {
    key,
    appId: meta.id,
    name: meta.name,
    bundle: meta.bundle,
  };

  const versionsRes = await getAppVersions(token, meta.id);
  if (!versionsRes.ok) {
    report.error = redactErrors(versionsRes.json);
    report.httpStatus = versionsRes.status;
    return report;
  }

  const version = pickVersion100(versionsRes.json);
  if (!version) {
    report.versions = [];
    report.blocker = "No App Store versions found";
    return report;
  }

  report.versionId = version.id;
  report.versionString = version.attributes.versionString;
  report.appStoreState = version.attributes.appStoreState;
  report.releaseType = version.attributes.releaseType;

  const detail = await getVersionDetail(token, version.id);
  const included = detail.json?.included || [];
  const buildRel = detail.json?.data?.relationships?.build?.data;
  const build = buildRel
    ? included.find((i) => i.type === "builds" && i.id === buildRel.id)
    : null;
  report.build = build
    ? {
        id: build.id,
        version: build.attributes?.version,
        processingState: build.attributes?.processingState,
      }
    : { attached: false };

  const buildsRes = await getBuilds(token, meta.id);
  report.recentBuilds = (buildsRes.json?.data || []).map((b) => ({
    id: b.id,
    version: b.attributes.version,
    processingState: b.attributes.processingState,
    uploadedDate: b.attributes.uploadedDate,
  }));

  const locs = await getLocalizations(token, version.id);
  const locList = locs.json?.data || [];
  report.localizations = locList.map((l) => ({
    id: l.id,
    locale: l.attributes.locale,
    hasDescription: !!l.attributes.description,
    hasKeywords: !!l.attributes.keywords,
    hasWhatsNew: !!l.attributes.whatsNew,
    hasSupportUrl: !!l.attributes.supportUrl,
    hasMarketingUrl: !!l.attributes.marketingUrl,
  }));

  let screenshotCount = 0;
  const screenshotSets = [];
  for (const loc of locList) {
    const ss = await getScreenshotSets(token, loc.id);
    for (const set of ss.json?.data || []) {
      const shots = (ss.json?.included || []).filter(
        (i) =>
          i.type === "appScreenshots" &&
          set.relationships?.appScreenshots?.data?.some((d) => d.id === i.id),
      );
      const n =
        set.relationships?.appScreenshots?.data?.length ?? shots.length ?? 0;
      screenshotCount += n;
      screenshotSets.push({
        localizationId: loc.id,
        locale: loc.attributes.locale,
        displayType: set.attributes?.screenshotDisplayType,
        count: n,
        setId: set.id,
      });
    }
  }
  report.screenshots = { total: screenshotCount, sets: screenshotSets };

  const review = await getReviewDetail(token, version.id);
  if (review.ok && review.json?.data) {
    const a = review.json.data.attributes || {};
    report.reviewDetail = {
      id: review.json.data.id,
      hasNotes: !!(a.notes && a.notes.length > 0),
      notesLength: a.notes?.length || 0,
      demoAccountRequired: a.demoAccountRequired,
      hasDemoAccountName: !!a.demoAccountName,
      hasDemoAccountPassword: !!a.demoAccountPassword,
      hasContactEmail: !!a.contactEmail,
      // do not echo notes/password
    };
  } else {
    report.reviewDetail = { exists: false, httpStatus: review.status };
  }

  const age = await getAgeRating(token, version.id);
  report.ageRating = age.ok
    ? { exists: !!age.json?.data, id: age.json?.data?.id }
    : { exists: false, httpStatus: age.status, error: redactErrors(age.json) };

  const appInfo = await getAppInfo(token, meta.id);
  const infos = appInfo.json?.data || [];
  report.appInfos = infos.map((i) => ({
    id: i.id,
    state: i.attributes?.state,
    ageRatingDeclarationState: i.attributes?.ageRatingDeclarationState,
    brazilAgeRating: i.attributes?.brazilAgeRating,
  }));

  const blockers = [];
  const editable = [
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
  ].includes(report.appStoreState);

  if (!editable && report.appStoreState !== "WAITING_FOR_REVIEW" && report.appStoreState !== "IN_REVIEW") {
    // READY_FOR_SALE etc.
  }
  if (!report.build?.id && !report.build?.attached) {
    // check if relationship missing
    if (!buildRel) blockers.push("No build attached to App Store version");
  }
  if (report.build?.processingState && report.build.processingState !== "VALID") {
    blockers.push(`Build processingState=${report.build.processingState}`);
  }
  if (screenshotCount === 0) {
    blockers.push("Screenshots missing (0 uploaded) — blocks Submit for Review");
  }
  if (!report.reviewDetail?.hasNotes) {
    blockers.push("Review notes not set");
  }
  if (!report.localizations.some((l) => l.hasDescription)) {
    blockers.push("Version localization description missing");
  }
  report.editable = editable;
  report.blockers = blockers;
  return report;
}

async function main() {
  const cmd = process.argv[2] || "all";
  const env = {
    ...loadEnvFile("/Users/senna/Projects/env"),
    ...process.env,
  };
  const keyId = env.APP_STORE_KEY_ID;
  const issuerId = env.APP_STORE_ISSUER_ID;
  const p8 =
    env.APP_STORE_P8_PATH ||
    "/Users/senna/Projects/acs/AuthKey_4GBZQNMPD3.p8";

  if (!keyId || !issuerId) {
    console.error("Missing APP_STORE_KEY_ID / APP_STORE_ISSUER_ID");
    process.exit(1);
  }
  if (!existsSync(p8)) {
    console.error("Missing p8 key file");
    process.exit(1);
  }

  console.log(`Auth: keyId=${keyId.slice(0, 4)}… issuer=${issuerId.slice(0, 8)}… p8=${p8.split("/").pop()}`);

  let token;
  try {
    token = await mintToken(keyId, issuerId, p8);
    // smoke
    const me = await api(token, "GET", `/apps?filter[bundleId]=${APPS.candidate.bundle}&limit=1`);
    if (!me.ok) {
      console.error("Auth failed with primary key:", me.status, JSON.stringify(redactErrors(me.json)));
      process.exit(1);
    }
    console.log("Auth OK");
  } catch (e) {
    console.error("JWT mint failed:", e.message);
    process.exit(1);
  }

  const creds = parseCreds(
    "/Users/senna/src/frog-systems/.secrets/frog-recruit-app-review-credentials.txt",
  );
  // contact phone: ASC often requires a phone; use a placeholder if unknown — better from env
  const contactBase = {
    firstName: "Yoshitaka",
    lastName: "Goto",
    contactEmail: "info@frogagent.com",
    // Public company phone from recruit.frogagent.com/privacy
    phone: env.APP_STORE_REVIEW_PHONE || "+1 778 829 3060",
  };

  const reports = {};
  for (const [key, meta] of Object.entries(APPS)) {
    console.log(`\n=== Inspect ${meta.name} (${meta.id}) ===`);
    reports[key] = await inspectApp(token, key, meta);
    console.log(
      JSON.stringify(
        {
          ...reports[key],
          // ensure no accidental password fields
        },
        null,
        2,
      ),
    );
  }

  if (cmd === "status") {
    return;
  }

  if (cmd === "set-notes" || cmd === "all") {
    for (const [key, meta] of Object.entries(APPS)) {
      const r = reports[key];
      if (!r.versionId) {
        console.log(`Skip notes ${key}: no version`);
        continue;
      }
      if (!r.editable) {
        console.log(
          `Skip notes ${key}: state=${r.appStoreState} (not editable)`,
        );
        continue;
      }
      const password = creds[key].password;
      const notes = buildReviewNotes(key, password);
      console.log(
        `\n=== Set review notes ${meta.name} (notesLen=${notes.length}, pwLen=${password.length}) ===`,
      );
      const res = await ensureReviewDetail(token, r.versionId, notes, {
        ...contactBase,
        email: creds[key].email,
        password,
      });
      console.log(
        "reviewDetail result:",
        res.status,
        res.ok ? "OK" : JSON.stringify(redactErrors(res.json)),
      );
      // refresh review detail presence only
      const check = await getReviewDetail(token, r.versionId);
      const a = check.json?.data?.attributes || {};
      console.log(
        "verify:",
        JSON.stringify({
          hasNotes: !!(a.notes && a.notes.length),
          notesLen: a.notes?.length || 0,
          hasDemoName: !!a.demoAccountName,
          hasDemoPassword: !!a.demoAccountPassword,
          notesContainVideo: (a.notes || "").includes(meta.video),
          notesContainPassword: (a.notes || "").includes(password),
        }),
      );
      // clear password from verify object already boolean only
    }
  }

  if (cmd === "submit" || cmd === "all") {
    for (const [key, meta] of Object.entries(APPS)) {
      console.log(`\n=== Attempt submit ${meta.name} ===`);
      // re-inspect blockers quickly
      const r = await inspectApp(token, key, meta);
      console.log(
        "pre-submit:",
        JSON.stringify({
          state: r.appStoreState,
          blockers: r.blockers,
          screenshots: r.screenshots?.total,
          build: r.build,
          reviewHasNotes: r.reviewDetail?.hasNotes,
        }),
      );

      if (r.appStoreState === "WAITING_FOR_REVIEW" || r.appStoreState === "IN_REVIEW") {
        console.log("Already in review pipeline — skip submit");
        continue;
      }
      if (!r.editable) {
        console.log(`Not editable (state=${r.appStoreState}) — skip`);
        continue;
      }
      if ((r.screenshots?.total || 0) === 0) {
        console.log("BLOCKED: screenshots missing — not submitting");
        continue;
      }
      if (!r.build?.id) {
        console.log("BLOCKED: no build attached — not submitting");
        continue;
      }

      const create = await createReviewSubmission(token, meta.id);
      console.log(
        "create reviewSubmission:",
        create.status,
        create.ok
          ? create.json?.data?.id
          : JSON.stringify(redactErrors(create.json)),
      );
      if (!create.ok) continue;
      const submissionId = create.json.data.id;
      const item = await addSubmissionItem(token, submissionId, r.versionId);
      console.log(
        "add item:",
        item.status,
        item.ok ? "OK" : JSON.stringify(redactErrors(item.json)),
      );
      if (!item.ok) continue;
      const sub = await submitReviewSubmission(token, submissionId);
      console.log(
        "submit:",
        sub.status,
        sub.ok
          ? JSON.stringify({
              id: sub.json?.data?.id,
              state: sub.json?.data?.attributes?.state,
              submittedDate: sub.json?.data?.attributes?.submittedDate,
            })
          : JSON.stringify(redactErrors(sub.json)),
      );
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
