import { registerAs } from '@nestjs/config';

export const pdfExportConfig = registerAs('pdfExport', () => ({
  /** Target print resolution — 300 DPI is the standard minimum for photo-quality print. Puppeteer's
   * `deviceScaleFactor` is relative to the page's own 72-DPI CSS pixel grid (see
   * `A4_PAGE_WIDTH`/`A4_PAGE_HEIGHT` on the frontend), so this needs to be a multiple of 72, not a
   * raw pixel count. */
  dpi: Number(process.env.PDF_EXPORT_DPI ?? 300),
  /** How long a single page's screenshot may take (navigation + font/photo loading + render) before
   * the export fails — generous, since a spread can have several full-resolution photos. */
  pageTimeoutMs: Number(process.env.PDF_EXPORT_PAGE_TIMEOUT_MS ?? 30_000),
  /** CMYK ICC profile sharp/libvips uses for each page's RGB→CMYK conversion (e.g. a copy of the
   * free "Coated FOGRA39" profile) — this is a binary file that has to be sourced and placed
   * manually, it's not something that can be generated. When unset or missing,
   * `PdfExportService` falls back to libvips' own built-in generic CMYK conversion (still real
   * CMYK, just without a specific print profile's gamut mapping) rather than failing the export
   * outright. */
  iccProfilePath: process.env.PDF_EXPORT_ICC_PROFILE_PATH ?? null,
}));
