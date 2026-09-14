/**
 * Best-effort DOM extractors for LinkedIn / Indeed / Glassdoor job pages.
 * Sites change markup often — empty fields are OK; URL alone still creates a lead.
 */
function extractJobFromPage() {
  const href = location.href;
  const host = location.hostname.toLowerCase();
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const meta = (sel) => document.querySelector(sel)?.getAttribute("content") || null;

  let source = "other";
  if (host.includes("linkedin.com")) source = "linkedin";
  else if (host.includes("indeed.")) source = "indeed";
  else if (host.includes("glassdoor.")) source = "glassdoor";

  let title = null;
  let companyName = null;
  let location = null;
  let description = null;
  let salary = null;
  let externalId = null;

  if (source === "linkedin") {
    title =
      text(document.querySelector(".job-details-jobs-unified-top-card__job-title")) ||
      text(document.querySelector("h1")) ||
      meta('meta[property="og:title"]');
    companyName =
      text(
        document.querySelector(
          ".job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name"
        )
      ) || null;
    location =
      text(
        document.querySelector(
          ".job-details-jobs-unified-top-card__tertiary-description-container, .job-details-jobs-unified-top-card__bullet"
        )
      ) || null;
    const descRoot =
      document.querySelector("#job-details") ||
      document.querySelector(".jobs-description__content") ||
      document.querySelector(".jobs-box__html-content");
    description = text(descRoot) || null;
    const m = href.match(/\/jobs\/view\/(\d+)/);
    if (m) externalId = m[1];
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
    location =
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
    location =
      text(document.querySelector("[data-test='location']")) || null;
    description =
      text(document.querySelector("[data-test='description']")) ||
      text(document.querySelector(".JobDetails_jobDescription__")) ||
      null;
  } else {
    title = text(document.querySelector("h1")) || meta('meta[property="og:title"]');
    description = meta('meta[property="og:description"]');
  }

  // Cap description size for API payload.
  if (description && description.length > 20000) {
    description = description.slice(0, 20000) + "…";
  }

  return {
    sourceUrl: href.split("#")[0],
    source,
    externalId,
    companyName,
    title,
    location,
    description,
    salary,
    postedAt: null,
    raw: {
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      titleDocument: document.title,
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
    if (!tab?.id) throw new Error("No active tab");

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobFromPage,
    });

    const res = await fetch(`${cfg.apiBase.replace(/\/$/, "")}/api/desk/job-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify(result),
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
