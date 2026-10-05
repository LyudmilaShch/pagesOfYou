import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import puppeteer, { type Browser, type BrowserContext, type Page } from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import type { AdminJwtPayload } from '../admin-auth/interfaces/admin-jwt-payload.interface';

const execFileAsync = promisify(execFile);

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
   * several seconds of pure startup overhead to every single-click admin export. */
  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      // --no-sandbox/--disable-setuid-sandbox: standard requirement for running Chromium as root
      // inside most server containers (the usual deployment shape here) — Chrome's sandbox needs
      // kernel namespace privileges a container typically doesn't grant.
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browserPromise;
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
    await page.goto(url, { waitUntil: 'networkidle0', timeout: timeoutMs });
    // Set by the print-view route (AdminOrderPrintPage.vue) once the stage is fully laid out —
    // fonts loaded, every photo's <img> resolved, zero zoom/pan drift — rather than guessing a
    // fixed settle delay that's either too short (half-loaded photos) or wastefully long.
    await page.waitForFunction('window.__printReady === true', { timeout: timeoutMs });
    return page;
  }

  private async addImagePage(pdfDoc: PDFDocument, png: Buffer, width: number, height: number): Promise<void> {
    const image = await pdfDoc.embedPng(png);
    const pdfPage = pdfDoc.addPage([width, height]);
    pdfPage.drawImage(image, { x: 0, y: 0, width, height });
  }

  /** Renders every journal page (cover, TOC, each spread, back cover — the full book, unlike
   * SpreadManagerDialog.vue which only ever touches SPREAD slots) through the real editor canvas
   * and assembles the screenshots into one RGB PDF. A SPREAD slot renders once at its full
   * (double-wide) size — same as the editor shows it — but becomes TWO separate A4 pages in the
   * PDF, one per physical leaf (cropped via Puppeteer's own `clip`, not a second navigation),
   * matching how the book is actually printed/bound rather than the editor's own side-by-side
   * convenience view. Every PDF page therefore ends up the same A4 size. */
  async buildPdf(order: OrderForPdfExport, admin: AdminJwtPayload): Promise<Buffer> {
    const frontendUrl = this.config.get<string>('app.frontendUrl');
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

  /** Ghostscript subprocess — converts the assembled RGB PDF to real DeviceCMYK. With a configured
   * ICC profile (see pdf-export.config.ts), the conversion follows that profile's actual print
   * gamut mapping; without one (profile unset or file missing — it has to be sourced and placed
   * manually, it isn't something this code can generate), Ghostscript's own default RGB→CMYK
   * conversion still runs — the output is still genuine DeviceCMYK, just without a specific
   * press/paper's calibration. */
  async convertToCmyk(pdfBuffer: Buffer): Promise<Buffer> {
    const ghostscriptBin = this.config.get<string>('pdfExport.ghostscriptBin') ?? 'gs';
    const iccProfilePath = this.config.get<string>('pdfExport.iccProfilePath');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-export-'));
    const inputPath = path.join(tmpDir, 'input.pdf');
    const outputPath = path.join(tmpDir, 'output.pdf');

    try {
      await fs.writeFile(inputPath, pdfBuffer);

      const hasIccProfile = iccProfilePath ? await fileExists(iccProfilePath) : false;
      if (iccProfilePath && !hasIccProfile) {
        this.logger.warn(`Configured ICC profile not found at "${iccProfilePath}" — converting without it.`);
      }

      const args = [
        '-dSAFER',
        '-dBATCH',
        '-dNOPAUSE',
        '-sDEVICE=pdfwrite',
        '-sColorConversionStrategy=CMYK',
        '-sProcessColorModel=DeviceCMYK',
        ...(hasIccProfile ? [`-sOutputICCProfile=${iccProfilePath}`] : []),
        `-sOutputFile=${outputPath}`,
        inputPath,
      ];

      try {
        await execFileAsync(ghostscriptBin, args);
      } catch (error: unknown) {
        // ENOENT specifically — the binary itself isn't installed/on PATH (e.g. a dev machine
        // without Ghostscript) — degrade to the RGB PDF rather than failing the whole export, so
        // the rest of the pipeline (Puppeteer rendering, pdf-lib assembly) stays testable without
        // it. Any OTHER Ghostscript failure (a genuinely malformed PDF, a bad ICC profile, …) still
        // throws, since silently shipping a broken "CMYK" file would be worse than failing loudly.
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          this.logger.warn(
            `Ghostscript ("${ghostscriptBin}") not found — returning the PDF as RGB, not CMYK. ` +
              'Install Ghostscript (see .env.example\'s PDF_EXPORT_GHOSTSCRIPT_BIN) for real print-ready output.',
          );
          return pdfBuffer;
        }
        throw error;
      }

      return await fs.readFile(outputPath);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
