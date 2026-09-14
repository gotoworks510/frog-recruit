/**
 * Best-effort DOM extractors for LinkedIn / Indeed / Glassdoor job pages.
 * Sites change markup often — empty fields are OK; URL alone still creates a lead.
 *
 * IMPORTANT: this function is serialized into the page via chrome.scripting.executeScript.
 * Keep it self-contained (no outer-scope references).
 */
function extractJobFromPage() {
  const href = location.href.split("#")[0];
  const host = location.hostname.toLowerCase();
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const meta = (sel) => document.querySelector(sel)?.getAttribute("content") || null;
  const firstText = (selectors) => {
    for (const sel of selectors) {
      const t = text(document.querySelector(sel));
      if (t) return t;
    }
    return null;
  };
  const stripHtml = (html) => {
    if (!html) return null;
    const d = document.createElement("div");
    d.innerHTML = html;
    return (d.textContent || "").replace(/\s+/g, " ").trim() || null;
  };

  /** LinkedIn (and others) often embed schema.org JobPosting JSON-LD. */
  const fromJsonLd = () => {
    const out = {
      title: null,
      companyName: null,
      locationText: null,
      description: null,
      salary: null,
    };
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      let data;
      try {
        data = JSON.parse(s.textContent || "");
      } catch {
        continue;
      }
      const nodes = Array.isArray(data)
        ? data
        : data?.["@graph"]
          ? data["@graph"]
          : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const typ = node["@type"];
        const isJob =
          typ === "JobPosting" ||
          (Array.isArray(typ) && typ.includes("JobPosting"));
        if (!isJob) continue;
        out.title = node.title || out.title;
        out.companyName =
          node.hiringOrganization?.name ||
          (typeof node.hiringOrganization === "string"
            ? node.hiringOrganization
            : null) ||
          out.companyName;
        out.description =
          stripHtml(node.description) || out.description;
        const loc = node.jobLocation;
        const locs = Array.isArray(loc) ? loc : loc ? [loc] : [];
        const parts = [];
        for (const L of locs) {
          const addr = L?.address || L;
          if (!addr || typeof addr !== "object") continue;
          const bit = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
            .filter(Boolean)
            .join(", ");
          if (bit) parts.push(bit);
        }
        if (parts.length) out.locationText = parts.join(" · ");
        const sal = node.baseSalary;
        if (sal && typeof sal === "object") {
          const val = sal.value;
          const min = val?.minValue ?? val?.value ?? sal.minValue;
          const max = val?.maxValue ?? sal.maxValue;
          const cur = sal.currency || val?.currency || "";
          if (min || max) {
            out.salary = [min, max].filter((x) => x != null).join(" – ") +
              (cur ? ` ${cur}` : "");
          }
        }
      }
    }
    return out;
  };

  let source = "other";
  if (host.includes("linkedin.com")) source = "linkedin";
  else if (host.includes("indeed.")) source = "indeed";
  else if (host.includes("glassdoor.")) source = "glassdoor";

  let title = null;
  let companyName = null;
  let locationText = null;
  let description = null;
  let salary = null;
  let externalId = null;
  let sourceUrl = href;

  const ld = fromJsonLd();

  if (source === "linkedin") {
    try {
      const u = new URL(href);
      const jobId =
        u.searchParams.get("currentJobId") ||
        (href.match(/\/jobs\/view\/(\d+)/) || [])[1] ||
        null;
      if (jobId) {
        externalId = jobId;
        sourceUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
      }
    } catch {
      /* ignore */
    }

    // Prefer JSON-LD, then logged-in unified UI, then public/guest topcard.
    title =
      ld.title ||
      firstText([
        ".job-details-jobs-unified-top-card__job-title a",
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title a",
        ".jobs-unified-top-card__job-title",
        ".top-card-layout__title",
        "h1.top-card-layout__title",
        ".topcard__title",
        "h1",
      ]) ||
      meta('meta[property="og:title"]');

    // og:title is often "Role | Company | LinkedIn"
    if (title && /\|\s*LinkedIn\s*$/i.test(title)) {
      const parts = title.split("|").map((p) => p.trim());
      if (parts.length >= 2) {
        title = parts[0] || title;
        if (!companyName && parts[1] && !/^LinkedIn$/i.test(parts[1])) {
          companyName = parts[1];
        }
      }
    }

    companyName =
      companyName ||
      ld.companyName ||
      firstText([
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name a",
        ".jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".top-card-layout__card a.topcard__org-name-link",
        ".job-details-jobs-unified-top-card__primary-description-container a",
      ]);

    locationText =
      ld.locationText ||
      firstText([
        ".job-details-jobs-unified-top-card__tertiary-description-container",
        ".job-details-jobs-unified-top-card__bullet",
        ".jobs-unified-top-card__bullet",
        ".topcard__flavor--bullet",
        ".topcard__flavor",
        ".job-details-jobs-unified-top-card__primary-description-container",
      ]);

    // Prefer the about-the-job article; avoid "more jobs" grids.
    const descRoot =
      document.querySelector(".show-more-less-html__markup") ||
      document.querySelector(".description__text") ||
      document.querySelector("#job-details") ||
      document.querySelector(".jobs-description__content") ||
      document.querySelector(".jobs-box__html-content") ||
      document.querySelector(".jobs-description-content__text") ||
      document.querySelector(".core-section-container__content");
    description = ld.description || text(descRoot) || null;
    salary = ld.salary || salary;
  } else if (source === "indeed") {
    title =
      ld.title ||
      firstText([
        "[data-testid='jobsearch-JobInfoHeader-title']",
        "h1",
      ]) ||
      meta('meta[property="og:title"]');
    companyName =
      ld.companyName ||
      firstText([
        "[data-testid='inlineHeader-companyName'] a",
        "[data-company-name='true']",
        ".jobsearch-InlineCompanyRating a",
      ]);
    locationText =
      ld.locationText ||
      firstText([
        "[data-testid='inlineHeader-companyLocation']",
        "[data-testid='job-location']",
      ]);
    description =
      ld.description ||
      text(document.querySelector("#jobDescriptionText")) ||
      text(document.querySelector(".jobsearch-JobComponent-description")) ||
      null;
    salary =
      ld.salary ||
      firstText([
        "#salaryInfoAndJobType",
        "[data-testid='attribute_snippet_testid']",
      ]);
    const m = href.match(/[?&]jk=([a-z0-9]+)/i) || href.match(/\/viewjob\?jk=([a-z0-9]+)/i);
    if (m) externalId = m[1];
  } else if (source === "glassdoor") {
    title =
      ld.title ||
      firstText(["[data-test='job-title']", "h1"]) ||
      meta('meta[property="og:title"]');
    companyName =
      ld.companyName ||
      firstText(["[data-test='employer-name']", "[data-test='employerName']"]);
    locationText = ld.locationText || firstText(["[data-test='location']"]);
    description =
      ld.description ||
      text(document.querySelector("[data-test='description']")) ||
      text(document.querySelector(".JobDetails_jobDescription__")) ||
      null;
    salary = ld.salary;
  } else {
    title = ld.title || text(document.querySelector("h1")) || meta('meta[property="og:title"]');
    companyName = ld.companyName;
    locationText = ld.locationText;
    description = ld.description || meta('meta[property="og:description"]');
    salary = ld.salary;
  }

  if (description && description.length > 20000) {
    description = description.slice(0, 20000) + "…";
  }

  // Drop useless titles.
  if (title && /^(linkedin|indeed|glassdoor)$/i.test(title.trim())) {
    title = null;
  }

  return {
    sourceUrl,
    source,
    externalId,
    companyName,
    title,
    location: locationText,
    description,
    salary,
    postedAt: null,
    raw: {
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      titleDocument: document.title,
      pageUrl: href,
      usedJsonLd: !!(ld.title || ld.description || ld.companyName),
    },
  };
}

document.getElementById("save").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const btn = document.getElementById("save");
  btn.disabled = true;
  status.textContent = "Capturing…";

  try {
    const cfg = await chrome.storage.sync.get({
      apiBase: "http://localhost:3005",
      token: "",
    });
    if (!cfg.token) {
      status.textContent =
        "Set JOB_INBOX_TOKEN in Options first (same as .env.local).";
      btn.disabled = false;
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error("No active tab");

    let payload = null;
    try {
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobFromPage,
      });
      const first = injected?.[0];
      if (first?.error) {
        console.warn("extract error", first.error);
      }
      if (first?.result && typeof first.result === "object") {
        payload = first.result;
      }
    } catch (injectErr) {
      console.warn("inject failed", injectErr);
    }

    if (!payload) {
      let source = "other";
      let sourceUrl = tab.url.split("#")[0];
      let externalId = null;
      try {
        const host = new URL(tab.url).hostname.toLowerCase();
        if (host.includes("linkedin.com")) {
          source = "linkedin";
          const u = new URL(tab.url);
          const jobId =
            u.searchParams.get("currentJobId") ||
            (tab.url.match(/\/jobs\/view\/(\d+)/) || [])[1] ||
            null;
          if (jobId) {
            externalId = jobId;
            sourceUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
          }
        } else if (host.includes("indeed.")) source = "indeed";
        else if (host.includes("glassdoor.")) source = "glassdoor";
      } catch {
        /* keep defaults */
      }
      payload = {
        sourceUrl,
        source,
        externalId,
        companyName: null,
        title: null,
        location: null,
        description: null,
        salary: null,
        postedAt: null,
        raw: { fallback: true, pageUrl: tab.url },
      };
    }

    const res = await fetch(`${cfg.apiBase.replace(/\/$/, "")}/api/desk/job-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      status.textContent = `Error ${res.status}: ${data.error || res.statusText}`;
      btn.disabled = false;
      return;
    }

    const bits = [
      data.duplicate ? "Updated existing lead" : "Saved",
      `score ${data.score}`,
    ];
    if (payload.title) bits.push(payload.title);
    if (payload.companyName) bits.push(payload.companyName);
    status.textContent = `${bits.join(" · ")}\n${data.inboxUrl}`;
  } catch (err) {
    status.textContent = String(err?.message || err);
  } finally {
    btn.disabled = false;
  }
});
