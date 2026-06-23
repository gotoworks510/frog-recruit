import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

/**
 * Stamp a per-request watermark over every page of a PDF (company + viewer +
 * timestamp). A visual deterrent, not DRM — defeatable by screenshot/print.
 *
 * Runs on the Workers runtime (pdf-lib is pure JS, no native deps / headless
 * browser). Returns the original bytes unchanged if the PDF can't be parsed.
 */
export async function watermarkPdf(
  source: ArrayBuffer,
  watermarkText: string
): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.load(source, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const text = watermarkText.slice(0, 120);

    for (const page of pages) {
      const { width, height } = page.getSize();
      const fontSize = Math.max(10, Math.min(18, width / 38));

      // Tile the watermark diagonally across the page at low opacity.
      const stepY = 150;
      for (let y = -height; y < height * 2; y += stepY) {
        page.drawText(text, {
          x: width * 0.08,
          y,
          size: fontSize,
          font,
          color: rgb(0.45, 0.45, 0.45),
          opacity: 0.16,
          rotate: degrees(35),
        });
      }
    }

    return await pdf.save();
  } catch (e) {
    console.error("[watermark] failed, returning original:", e);
    return new Uint8Array(source);
  }
}

/** Build the watermark line baked into each request's PDF. */
export function watermarkLine(params: {
  companyName: string;
  viewerEmail: string;
  isoTimestamp: string;
}): string {
  return `${params.companyName} • ${params.viewerEmail} • ${params.isoTimestamp} • CONFIDENTIAL`;
}
