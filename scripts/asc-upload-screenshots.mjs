#!/usr/bin/env node
/**
 * Upload local 6.5" screenshots to App Store Connect (APP_IPHONE_65).
 *
 *   node scripts/asc-upload-screenshots.mjs
 *
 * Reads PNGs from frog-recruit-mobile/store-screenshots/{candidate,employer}/
 * Auth: /Users/senna/Projects/env + AuthKey_*.p8
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { SignJWT, importPKCS8 } from "jose";

const ASC = "https://api.appstoreconnect.apple.com/v1";
const DISPLAY = "APP_IPHONE_65";
const SHOT_ROOT = join(
  process.env.HOME,
  "src/frog-systems/frog-recruit-mobile/store-screenshots"
);

const APPS = {
  candidate: { id: "6812968612", dir: "candidate" },
  employer: { id: "6812968390", dir: "employer" },
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
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, ok: res.ok, json };
}

async function ensureScreenshotSet(token, localizationId) {
  const existing = await api(
    token,
    "GET",
    `/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?include=appScreenshots&limit=20`
  );
  const sets = existing.json?.data || [];
  let set = sets.find((s) => s.attributes?.screenshotDisplayType === DISPLAY);
  if (set) {
    // Clear previous screenshots so we replace cleanly.
    const related =
      set.relationships?.appScreenshots?.data ||
      (existing.json?.included || [])
        .filter(
          (i) =>
            i.type === "appScreenshots" &&
            set.relationships?.appScreenshots?.data?.some((d) => d.id === i.id)
        )
        .map((i) => ({ id: i.id }));
    for (const shot of related) {
      await api(token, "DELETE", `/appScreenshots/${shot.id}`);
    }
    return set.id;
  }
  const created = await api(token, "POST", "/appScreenshotSets", {
    data: {
      type: "appScreenshotSets",
      attributes: { screenshotDisplayType: DISPLAY },
      relationships: {
        appStoreVersionLocalization: {
          data: { type: "appStoreVersionLocalizations", id: localizationId },
        },
      },
    },
  });
  if (!created.ok) {
    throw new Error(
      `create screenshot set failed: ${JSON.stringify(created.json)}`
    );
  }
  return created.json.data.id;
}

async function uploadOne(token, setId, filePath) {
  const buf = readFileSync(filePath);
  const fileName = basename(filePath);
  const fileSize = buf.length;
  const md5 = createHash("md5").update(buf).digest("hex");

  const reserved = await api(token, "POST", "/appScreenshots", {
    data: {
      type: "appScreenshots",
      attributes: { fileName, fileSize },
      relationships: {
        appScreenshotSet: {
          data: { type: "appScreenshotSets", id: setId },
        },
      },
    },
  });
  if (!reserved.ok) {
    throw new Error(
      `reserve ${fileName} failed (${reserved.status}): ${JSON.stringify(reserved.json)}`
    );
  }
  const shotId = reserved.json.data.id;
  const ops = reserved.json.data.attributes.uploadOperations || [];
  for (const op of ops) {
    const length = op.length ?? fileSize;
    const offset = op.offset ?? 0;
    const chunk = buf.subarray(offset, offset + length);
    const headers = {};
    for (const h of op.requestHeaders || []) {
      headers[h.name] = h.value;
    }
    const put = await fetch(op.url, {
      method: op.method || "PUT",
      headers,
      body: chunk,
    });
    if (!put.ok) {
      const t = await put.text();
      throw new Error(`PUT ${fileName} failed ${put.status}: ${t.slice(0, 200)}`);
    }
  }

  const commit = await api(token, "PATCH", `/appScreenshots/${shotId}`, {
    data: {
      type: "appScreenshots",
      id: shotId,
      attributes: { uploaded: true, sourceFileChecksum: md5 },
    },
  });
  if (!commit.ok) {
    throw new Error(
      `commit ${fileName} failed: ${JSON.stringify(commit.json)}`
    );
  }
  return shotId;
}

async function localizationForApp(token, appId) {
  const versions = await api(
    token,
    "GET",
    `/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10&include=appStoreVersionLocalizations`
  );
  const version =
    (versions.json?.data || []).find(
      (v) =>
        v.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION" ||
        v.attributes?.appStoreState === "READY_FOR_REVIEW"
    ) || versions.json?.data?.[0];
  if (!version) throw new Error(`no version for app ${appId}`);
  const locs = await api(
    token,
    "GET",
    `/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=10`
  );
  const en =
    (locs.json?.data || []).find((l) => l.attributes?.locale === "en-US") ||
    locs.json?.data?.[0];
  if (!en) throw new Error(`no localization for version ${version.id}`);
  return {
    versionId: version.id,
    versionString: version.attributes?.versionString,
    state: version.attributes?.appStoreState,
    localizationId: en.id,
  };
}

async function main() {
  const env = {
    ...loadEnvFile("/Users/senna/Projects/env"),
    ...process.env,
  };
  const keyId = env.APP_STORE_KEY_ID;
  const issuerId = env.APP_STORE_ISSUER_ID;
  const p8 =
    env.APP_STORE_P8_PATH ||
    `/Users/senna/Projects/acs/AuthKey_${keyId}.p8`;
  if (!keyId || !issuerId || !existsSync(p8)) {
    throw new Error("Missing APP_STORE_KEY_ID / ISSUER_ID / p8");
  }
  const token = await mintToken(keyId, issuerId, p8);

  for (const [kind, app] of Object.entries(APPS)) {
    const dir = join(SHOT_ROOT, app.dir);
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".png") && /^\d{2}-/.test(f))
      .sort();
    if (files.length === 0) {
      console.log(`[${kind}] no PNGs in ${dir}`);
      continue;
    }
    const meta = await localizationForApp(token, app.id);
    console.log(
      `[${kind}] version ${meta.versionString} (${meta.state}) → upload ${files.length} shots`
    );
    const setId = await ensureScreenshotSet(token, meta.localizationId);
    for (const f of files) {
      const id = await uploadOne(token, setId, join(dir, f));
      console.log(`  ✓ ${f} → ${id}`);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
