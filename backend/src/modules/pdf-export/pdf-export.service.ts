import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { promises as fs } from 'fs';
import puppeteer, { type Browser, type BrowserContext, type Page } from 'puppeteer';
import type SharpType from 'sharp';
import { PDFDocument } from 'pdf-lib';
import type { AdminJwtPayload } from '../admin-auth/interfaces/admin-jwt-payload.interface';

// Plain require(), not `import sharp from 'sharp'` — sharp's published types (`dist/index.d.mts`)
// describe it as an ESM module with a `default` export, so under this project's tsconfig (no
// `esModuleInterop`) a normal default-import statement gets every one of its usages rewritten to a
// `.default` access at runtime — but sharp's actual CommonJS build (`dist/index.cjs`) exports the
// function directly, with no `.default` wrapper of its own (unlike e.g. puppeteer, which does
// carry one), so that access is `undefined`. A plain `require()` call is never subject to that
// import-statement rewriting, so it gets the real thing; `import type` supplies the type for it
// separately, with zero runtime effect.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof SharpType = require('sharp');

/** Mirrors `src/modules/editor/constants/page.constants.ts` on the frontend — "logical editor
 * units" there are literally PDF points (72 DPI), so these double as both the print-view's CSS
 * pixel size at 1x and the PDF page size in points, with no conversion needed either way. */
const A4_PAGE_WIDTH = 595;
const A4_PAGE_HEIGHT = 842;
const A4_SPREAD_PAGE_WIDTH = A4_PAGE_WIDTH * 2;

export interface OrderForPdfExport {
  id: string;
  journalPages: Array<{ id: string; slotType: string }>;
}

@Injectable()
export class PdfExportService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfExportService.name);
  private browserPromise: Promise<Browser> | null = null;
  private iccProfileWarned = false;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      await browser?.close();
    }
  }

  /** One headless Chrome instance, reused across exports — launching fresh per request would add
   * several seconds of pure startup overhead to every single-click admin export. A failed or
   * already-disconnected browser is dropped so the next export can launch again. */
  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise) {
      const existing = await this.browserPromise.catch(() => null);
      if (existing?.connected) {
        return existing;
      }
      this.browserPromise = null;
    }

    this.browserPromise = this.launchBrowser();
    return this.browserPromise;
  }

  private launchBrowser(): Promise<Browser> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    // --no-sandbox/--disable-setuid-sandbox: Chromium as root in a container has no user namespace.
    // --disable-dev-shm-usage: Docker's /dev/shm is 64MB, and a 300 DPI page crashes Chrome without
    // this (the export then comes back as 500).
    return puppeteer
      .launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      })
      .catch((error: unknown) => {
        this.browserPromise = null;
        throw error;
      });
  }

  /** The print route lives on the public site. FRONTEND_URL often lists localhost first for local
   * CORS; Puppeteer on the server cannot open that. */
  private printFrontendUrl(): string {
    const explicit = this.config.get<string>('pdfExport.frontendUrl')?.replace(/\/$/, '');
    if (explicit) {
      return explicit;
    }

    const urls = this.config.get<string[]>('app.frontendUrls') ?? [];
    const production = this.config.get<string>('app.nodeEnv') === 'production';
    const usable = production ? urls.filter((url) => !isLocalOrigin(url)) : urls;
    const chosen = (usable.find((url) => url.startsWith('https://')) ?? usable[0] ?? '').replace(
      /\/$/,
      '',
    );
    if (!chosen) {
      throw new Error(
        'No public FRONTEND_URL for the print page. Set PDF_EXPORT_FRONTEND_URL to the site origin.',
      );
    }
    return chosen;
  }

  /** A real admin JWT (same shape `AdminJwtStrategy` already validates), just short-lived and
   * scoped to this one export — the print-view route (frontend) reads it from the URL and uses it
   * as its own Bearer token against the existing admin API, so no new guard/strategy is needed on
   * the backend side at all. */
  mintExportToken(admin: AdminJwtPayload): string {
    const payload: AdminJwtPayload = { sub: admin.sub, email: admin.email, role: 'ADMIN', type: 'admin' };
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('adminJwt.secret'),
      expiresIn: '10m',
    });
  }

  private async loadPrintPage(
    context: BrowserContext,
    url: string,
    viewportWidthPt: number,
    viewportHeightPt: number,
  ): Promise<Page> {
    const dpi = this.config.get<number>('pdfExport.dpi') ?? 300;
    const timeoutMs = this.config.get<number>('pdfExport.pageTimeoutMs') ?? 30_000;
    const deviceScaleFactor = dpi / 72;

    const page = await context.newPage();
    await page.setViewport({ width: viewportWidthPt, height: viewportHeightPt, deviceScaleFactor });
    // domcontentloaded, not networkidle0: the print page keeps requesting fonts and photos, so
    // "no connections" often never happens and the export dies at 30s. Readiness is __printReady.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    try {
      await page.waitForFunction('window.__printReady === true', { timeout: timeoutMs });
    } catch (error) {
      const pageText = await page
        .evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 300) ?? '')
        .catch(() => '');
      const reason = error instanceof Error ? error.message : 'print page was not ready';
      throw new Error(pageText ? `${reason} Page said: ${pageText}` : reason);
    }
    return page;
  }

  /** Converts a screenshot to a real 4-channel CMYK JPEG via sharp/libvips — with a configured ICC
   * profile (see pdf-export.config.ts), the conversion follows that profile's actual print gamut
   * mapping; without one (unset, or the file is missing — it has to be sourced and placed
   * manually, it isn't something this code can generate), libvips' own built-in generic CMYK
   * conversion still runs, so the output is still genuine CMYK, just without a specific
   * press/paper's calibration. `pdf-lib`'s JPEG embedder (see `addImagePage`) auto-detects a
   * 4-channel JPEG and marks the PDF image DeviceCMYK on its own — no separate whole-PDF
   * conversion pass needed, unlike the Ghostscript approach this replaced. */
  private async toCmykJpeg(png: Buffer): Promise<Buffer> {
    const iccProfilePath = this.config.get<string>('pdfExport.iccProfilePath');
    const hasIccProfile = iccProfilePath ? await fileExists(iccProfilePath) : false;
    if (iccProfilePath && !hasIccProfile && !this.iccProfileWarned) {
      this.iccProfileWarned = true;
      this.logger.warn(`Configured ICC profile not found at "${iccProfilePath}" — converting without it.`);
    }

    let pipeline = sharp(png).toColorspace('cmyk');
    if (hasIccProfile) {
      pipeline = pipeline.withIccProfile(iccProfilePath as string);
    }

    // chromaSubsampling 4:4:4 (no subsampling) — the default 4:2:0 softens fine detail, which
    // matters more here than usual: these JPEGs ARE the print file, not an intermediate preview.
    return pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
  }

  private async addImagePage(pdfDoc: PDFDocument, png: Buffer, width: number, height: number): Promise<void> {
    const cmykJpeg = await this.toCmykJpeg(png);
    const image = await pdfDoc.embedJpg(cmykJpeg);
    const pdfPage = pdfDoc.addPage([width, height]);
    pdfPage.drawImage(image, { x: 0, y: 0, width, height });
  }

  /** Renders every journal page (cover, TOC, each spread, back cover — the full book, unlike
   * SpreadManagerDialog.vue which only ever touches SPREAD slots) through the real editor canvas
   * and assembles the screenshots into one print-ready CMYK PDF (see `toCmykJpeg`). A SPREAD slot
   * renders once at its full (double-wide) size — same as the editor shows it — but becomes TWO
   * separate A4 pages in the PDF, one per physical leaf (cropped via Puppeteer's own `clip`, not a
   * second navigation), matching how the book is actually printed/bound rather than the editor's
   * own side-by-side convenience view. Every PDF page therefore ends up the same A4 size. */
  async buildPdf(order: OrderForPdfExport, admin: AdminJwtPayload): Promise<Buffer> {
    const frontendUrl = this.printFrontendUrl();
    const token = this.mintExportToken(admin);
    const browser = await this.getBrowser();

    // A dedicated browser context (its own cookie/localStorage jar) per export, not just a new tab
    // in the shared default context — the print-view route authenticates by writing the export
    // token into localStorage (see AdminOrderPrintPage.vue), which is scoped per *context*, not
    // per tab/page. Reusing the default context across concurrent exports (two admins downloading
    // different orders' PDFs at once) would let one export's token clobber the other's mid-flight.
    const context = await browser.createBrowserContext();

    try {
      const pdfDoc = await PDFDocument.create();

      for (const journalPage of order.journalPages) {
        const isSpread = journalPage.slotType === 'SPREAD';
        const viewportWidth = isSpread ? A4_SPREAD_PAGE_WIDTH : A4_PAGE_WIDTH;
        const printUrl = `${frontendUrl}/admin/orders/${order.id}/print/${journalPage.id}?token=${encodeURIComponent(token)}`;

        this.logger.log(`Rendering journal page ${journalPage.id} (${journalPage.slotType}) for order ${order.id}`);
        const page = await this.loadPrintPage(context, printUrl, viewportWidth, A4_PAGE_HEIGHT);

        try {
          if (isSpread) {
            const left = await page.screenshot({
              type: 'png',
              clip: { x: 0, y: 0, width: A4_PAGE_WIDTH, height: A4_PAGE_HEIGHT },
            });
            const right = await page.screenshot({
              type: 'png',
              clip: { x: A4_PAGE_WIDTH, y: 0, width: A4_PAGE_WIDTH, height: A4_PAGE_HEIGHT },
            });
            await this.addImagePage(pdfDoc, Buffer.from(left), A4_PAGE_WIDTH, A4_PAGE_HEIGHT);
            await this.addImagePage(pdfDoc, Buffer.from(right), A4_PAGE_WIDTH, A4_PAGE_HEIGHT);
          } else {
            const screenshot = await page.screenshot({ type: 'png' });
            await this.addImagePage(pdfDoc, Buffer.from(screenshot), A4_PAGE_WIDTH, A4_PAGE_HEIGHT);
          }
        } finally {
          await page.close();
        }
      }

      const bytes = await pdfDoc.save();
      return Buffer.from(bytes);
    } finally {
      await context.close();
    }
  }
}

function isLocalOrigin(url: string): boolean {
  return /:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
