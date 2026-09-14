/**
 * Shared Frog Recruit HTML email wrapper.
 * Matches the site brand: forest green (#0f3024) header, cream surface, mint accents.
 */

export function baseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://recruit.frogagent.com"
  );
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "#0f3024";
const BRAND_SOFT = "#1a3d2e";
const SURFACE = "#f7f5ed";
const PAPER = "#ffffff";
const INK = "#1a2420";
const MUTED = "#6b756f";
const LINE = "#ddd9cf";
const MINT = "#dceee4";

function logoUrl(): string {
  return `${baseUrl().replace(/\/$/, "")}/brand/logo-frog-w.png`;
}

/** Marker embedded in every shell — sendEmail always applies this wrapper. */
export const EMAIL_SHELL_MARKER = "<!-- frog-recruit-email-shell -->";

/**
 * Full HTML document wrapper used by all transactional emails.
 * Do not call from feature code with a full document — use sendEmail({ subtitle, bodyHtml }).
 */
export function wrapEmailHtml(params: {
  subtitle: string;
  bodyHtml: string;
}): string {
  const { subtitle, bodyHtml } = params;
  const logo = logoUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Frog Recruit</title>
</head>
<body style="margin:0;padding:0;background-color:${SURFACE};font-family:Inter,'Hiragino Sans','Noto Sans JP',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${EMAIL_SHELL_MARKER}
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(subtitle)} — Frog Recruit
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${SURFACE};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background-color:${PAPER};border-radius:16px;overflow:hidden;border:1px solid ${LINE};">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND};padding:28px 36px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logo}" alt="Frog" width="48" height="48" style="display:block;width:48px;height:48px;border:0;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
                      for Employers
                    </p>
                    <h1 style="margin:6px 0 0;color:#ffffff;font-family:Georgia,'Source Serif 4',serif;font-size:26px;font-weight:600;line-height:1.25;letter-spacing:-0.02em;">
                      Talent introductions
                    </h1>
                    <p style="margin:10px 0 0;color:rgba(255,255,255,0.78);font-size:14px;line-height:1.5;">
                      ${escapeHtml(subtitle)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;color:${INK};font-size:15px;line-height:1.7;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:${SURFACE};padding:22px 36px;border-top:1px solid ${LINE};">
              <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.55;text-align:center;">
                Frog Creator Production Inc. · Vancouver
              </p>
              <p style="margin:6px 0 0;color:${MUTED};font-size:11px;line-height:1.5;text-align:center;">
                Thoughtful introductions for hiring teams and candidates.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;color:${MUTED};font-size:11px;text-align:center;">
          If you weren&apos;t expecting this email, you can ignore it.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Primary CTA button — forest green, matches site btn-primary. */
export function primaryButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;letter-spacing:0.01em;">${escapeHtml(
    label
  )}</a>`;
}

/** Soft mint callout strip. */
export function mintNote(html: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;">
    <tr>
      <td style="background-color:${MINT};border-radius:10px;padding:14px 16px;color:${BRAND_SOFT};font-size:13px;line-height:1.55;">
        ${html}
      </td>
    </tr>
  </table>`;
}

/** Credential / key-value card used in account emails. */
export function credentialCard(
  rows: Array<{ label: string; value: string; mono?: boolean }>
): string {
  const body = rows
    .map((row, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${LINE};`;
      const valueStyle = row.mono
        ? `font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;font-weight:600;color:${INK};letter-spacing:0.02em;`
        : `font-weight:600;color:${INK};`;
      return `<tr>
        <td style="padding:12px 16px;color:${MUTED};font-size:12px;width:38%;${border}">${escapeHtml(
          row.label
        )}</td>
        <td style="padding:12px 16px;${valueStyle}${border}">${escapeHtml(
          row.value
        )}</td>
      </tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid ${LINE};border-radius:12px;overflow:hidden;background-color:${SURFACE};">
    ${body}
  </table>`;
}
