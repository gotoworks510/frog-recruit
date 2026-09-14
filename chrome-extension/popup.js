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

  // LinkedIn search-results URLs carry the selected job in currentJobId.
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

    title =
      text(document.querySelector(".job-details-jobs-unified-top-card__job-title")) ||
      text(document.querySelector(".jobs-unified-top-card__job-title")) ||
      text(document.querySelector("h1")) ||
      meta('meta[property="og:title"]');
    companyName =
      text(
        document.querySelector(
          ".job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name"
        )
      ) || null;
    locationText =
      text(
        document.querySelector(
          ".job-details-jobs-unified-top-card__tertiary-description-container, .job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet"
        )
      ) || null;
    const descRoot =
      document.querySelector("#job-details") ||
      document.querySelector(".jobs-description__content") ||
      document.querySelector(".jobs-box__html-content") ||
      document.querySelector(".jobs-description-content__text");
    description = text(descRoot) || null;
  } else if (source === "indeed") {
    title =
      text(document.querySelector("[data-testid='jobsearch-JobInfoHeader-title']")) ||
      text(document.querySelector("h1")) ||
      meta('meta[property="og:title"]');
    companyName =
      text(
        document.querySelector(
          "[data-testid='inlineHeader-companyName'] a, [data-company-name='true'], .jobsearch-InlineCompanyRating a"
        )
      ) || null;
    locationText =
      text(
        document.querySelector(
          "[data-testid='inlineHeader-companyLocation'], [data-testid='job-location']"
        )
      ) || null;
    description =
      text(document.querySelector("#jobDescriptionText")) ||
      text(document.querySelector(".jobsearch-JobComponent-description")) ||
      null;
    salary =
      text(document.querySelector("#salaryInfoAndJobType")) ||
      text(document.querySelector("[data-testid='attribute_snippet_testid']")) ||
      null;
    const m = href.match(/[?&]jk=([a-z0-9]+)/i) || href.match(/\/viewjob\?jk=([a-z0-9]+)/i);
    if (m) externalId = m[1];
  } else if (source === "glassdoor") {
    title =
      text(document.querySelector("[data-test='job-title']")) ||
      text(document.querySelector("h1")) ||
      meta('meta[property="og:title"]');
    companyName =
      text(document.querySelector("[data-test='employer-name']")) ||
      text(document.querySelector("[data-test='employerName']")) ||
      null;
    locationText = text(document.querySelector("[data-test='location']")) || null;
    description =
      text(document.querySelector("[data-test='description']")) ||
      text(document.querySelector(".JobDetails_jobDescription__")) ||
      null;
  } else {
    title = text(document.querySelector("h1")) || meta('meta[property="og:title"]');
    description = meta('meta[property="og:description"]');
  }

  if (description && description.length > 20000) {
    description = description.slice(0, 20000) + "…";
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

    // Fallback: URL-only lead (still useful for Inbox triage).
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
        title: tab.title || null,
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

    status.textContent = data.duplicate
      ? `Updated existing lead (score ${data.score}).\n${data.inboxUrl}`
      : `Saved (score ${data.score}).\n${data.inboxUrl}`;
  } catch (err) {
    status.textContent = String(err?.message || err);
  } finally {
    btn.disabled = false;
  }
});
