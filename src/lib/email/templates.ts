/**
 * Shared Frog Recruit HTML email wrapper. On-brand (teal header) layout used by
 * all transactional emails.
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

export function wrapEmailHtml(params: { subtitle: string; bodyHtml: string }): string {
  const { subtitle, bodyHtml } = params;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Hiragino Sans','Noto Sans JP',Inter,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#4ebfa5 0%,#3aa189 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Frog Recruit</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${escapeHtml(subtitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;color:#1f1f1f;font-size:15px;line-height:1.7;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafb;padding:24px 40px;text-align:center;border-top:1px solid #e8ecef;">
              <p style="margin:0;color:#a0aec0;font-size:12px;">&copy; Frog Creator Production Inc.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function primaryButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#4ebfa5;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;">${escapeHtml(
    label
  )}</a>`;
}
