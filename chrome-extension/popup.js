/**
 * Best-effort DOM extractors for LinkedIn / Indeed / Glassdoor job pages.
 * IMPORTANT: serialized into the page via chrome.scripting.executeScript.
 * Keep self-contained. Async is OK — MV3 waits on the returned Promise.
 */
async function extractJobFromPage() {
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

  const clickSeeMore = () => {
    const nodes = Array.from(document.querySelectorAll("button, [role='button'], a"));
    for (const b of nodes) {
      const t = (b.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (
        t === "see more" ||
        t === "show more" ||
        t === "…see more" ||
        t === "...see more" ||
        t === "もっと見る" ||
        t.endsWith(" see more")
      ) {
        try {
          b.click();
        } catch {
          /* ignore */
        }
      }
    }
  };

  /** Slice visible page text between About the job → next section. */
  const aboutJobFromInnerText = () => {
    const full = document.body?.innerText || "";
    if (full.length < 40) return null;
    const sm = /About the job/i.exec(full);
    if (!sm) return null;
    const start = sm.index + sm[0].length;
    const endRes = [
      /About the company/i,
      /Show more jobs/i,
      /More jobs like this/i,
      /People also viewed/i,
      /Similar jobs/i,
      /How you match/i,
      /Hiring team/i,
      /Meet the hiring team/i,
      /Applicant insights/i,
      /Set an alert/i,
      /Explore premium profile/i,
    ];
    let end = full.length;
    const rest = full.slice(start);
    for (const er of endRes) {
      const m = er.exec(rest);
      if (m) end = Math.min(end, start + m.index);
    }
    let out = full
      .slice(start, end)
      .replace(/^\s*see more\s*/i, "")
      .replace(/\s*see less\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (out.length < 80) return null;
    return out.slice(0, 20000);
  };

  const locationFromPageText = () => {
    const lines = (document.body?.innerText || "")
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 40);
    for (const line of lines) {
      if (line.length > 160) continue;
      if (
        /·/.test(line) &&
        /(remote|hybrid|on-?site|canada|united states|\bUSA\b|\bUS\b|vancouver|toronto|british columbia|california|new york)/i.test(
          line
        )
      ) {
        return line
          .replace(/\s*·\s*(Posted|Reposted).*$/i, "")
          .replace(/\s*·\s*Over \d+.*$/i, "")
          .replace(/\s*·\s*\d+\s+applicants.*$/i, "")
          .replace(/\s*Easy Apply.*$/i, "")
          .trim();
      }
    }
    return null;
  };

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
        out.description = stripHtml(node.description) || out.description;
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
            out.salary =
              [min, max].filter((x) => x != null).join(" – ") +
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
  let descriptionMethod = null;

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

    clickSeeMore();
    await new Promise((r) => setTimeout(r, 450));
    clickSeeMore();
    await new Promise((r) => setTimeout(r, 300));

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
      ]) ||
      locationFromPageText();

    const descRoot =
      document.querySelector(".show-more-less-html__markup") ||
      document.querySelector(".description__text") ||
      document.querySelector("#job-details") ||
      document.querySelector(".jobs-description__content") ||
      document.querySelector(".jobs-box__html-content") ||
      document.querySelector(".jobs-description-content__text") ||
      document.querySelector(".jobs-description") ||
      document.querySelector("article.jobs-description__container") ||
      document.querySelector(".core-section-container__content");

    if (ld.description && ld.description.length >= 80) {
      description = ld.description;
      descriptionMethod = "jsonld";
    } else if (text(descRoot) && text(descRoot).length >= 80) {
      description = text(descRoot);
      descriptionMethod = "dom";
    } else {
      description = aboutJobFromInnerText();
      descriptionMethod = description ? "innerText-slice" : null;
    }

    salary = ld.salary || salary;
  } else if (source === "indeed") {
    title =
      ld.title ||
      firstText(["[data-testid='jobsearch-JobInfoHeader-title']", "h1"]) ||
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
      firstText(["#salaryInfoAndJobType", "[data-testid='attribute_snippet_testid']"]);
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

  if (title && /^(linkedin|indeed|glassdoor)$/i.test(title.trim())) {
    title = null;
  }

  const docTitle = (document.title || "").replace(/\s+/g, " ").trim();
  if (source === "linkedin" && docTitle) {
    const parts = docTitle.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && /^linkedin$/i.test(parts[parts.length - 1])) {
      if (!title) title = parts[0] || null;
      if (!companyName && parts[1] && !/^linkedin$/i.test(parts[1])) {
        companyName = parts[1];
      }
    } else if (!title && docTitle && !/^linkedin$/i.test(docTitle)) {
      title = docTitle;
    }
  } else if (!title && docTitle) {
    title = docTitle;
  }

  if (!description) {
    description =
      meta('meta[property="og:description"]') ||
      meta('meta[name="description"]') ||
      null;
    if (description) descriptionMethod = descriptionMethod || "meta";
  }

  if (source === "linkedin" && (!description || description.length < 80)) {
    const sliced = aboutJobFromInnerText();
    if (sliced && sliced.length > (description?.length || 0)) {
      description = sliced;
      descriptionMethod = "innerText-slice";
    }
  }

  if (source === "linkedin" && !locationText) {
    locationText = locationFromPageText();
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
      descriptionMethod,
      descriptionLength: description ? description.length : 0,
      bodyTextLength: (document.body?.innerText || "").length,
    },
  };
}

document.getElementById("save").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const btn = document.getElementById("save");
  btn.disabled = true;
  status.textContent = "Capturing (expanding See more)…";

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
      if (first?.error) console.warn("extract error", first.error);
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
        raw: {
          fallback: true,
          pageUrl: tab.url,
          titleDocument: tab.title || null,
        },
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

    const label = [data.title, data.companyName].filter(Boolean).join(" @ ");
    const descLen = payload.description ? payload.description.length : 0;
    const method = payload.raw?.descriptionMethod || "?";
    status.textContent = label
      ? `${data.duplicate ? "Updated" : "Saved"}: ${label}\nJD ${descLen} chars (${method})\nscore ${data.score}\n${data.inboxUrl}`
      : `${data.duplicate ? "Updated" : "Saved"} (score ${data.score}).\nJD ${descLen} chars\n${data.inboxUrl}`;
  } catch (err) {
    status.textContent = String(err?.message || err);
  } finally {
    btn.disabled = false;
  }
});
