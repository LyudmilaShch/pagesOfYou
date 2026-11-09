import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import type SharpType from 'sharp';
import { orderPhotoHeicFailedMessage, orderPhotoHeicTooLargeMessage } from './photo-upload-error';

// Same require() pattern as pdf-export.service.ts — sharp's CJS build has no `.default`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof SharpType = require('sharp');

/**
 * heic-decode ships libheif compiled to WASM with an HEVC decoder (libde265).
 * sharp's prebuilt libvips includes libheif but not libde265, so it can read a HEIC
 * header and still cannot decode iPhone pixels ("Support for this compression format
 * has not been built in: HEVC"). Decoding here and encoding the JPEG with sharp keeps
 * the print-quality settings (quality 95, chroma 4:4:4 — the same ones pdf-export uses)
 * without a system libheif on Alpine/Render.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const decodeHeic = require('heic-decode') as (input: {
  buffer: Buffer;
}) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>;

/** Matches pdf-export.service.ts `toCmykJpeg` — the stored master should not be softer than the print file. */
const ORDER_PHOTO_JPEG_QUALITY = 95;

/**
 * iPhone 48MP stills are ~49 megapixels; panoramas run larger. Above this the RGBA decode
 * alone is hundreds of megabytes, which is enough to take down a small Render instance.
 * This is a safety cap, not the upload size limit (that one is 20 MB, enforced by multer).
 */
const MAX_HEIC_PIXELS = 80_000_000;

const STORABLE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const HEIF_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const ORDER_PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

const HEIF_EXTENSIONS = new Set(['.heic', '.heif']);

/** Major brands written by iPhone and other HEIF stills. AVIF (`avif`/`avis`) is intentionally absent. */
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

export interface PreparedOrderPhoto {
  buffer: Buffer;
  mimetype: string;
  /**
   * Leading-dot extension to store under. `null` means "keep the original filename's extension"
   * so JPEG/PNG/WebP uploads are byte-identical to before HEIC support existed.
   */
  extension: string | null;
  /** Pixel size of a converted HEIC. `null` for files we did not transcode — the client measurement stands. */
  width: number | null;
  height: number | null;
  convertedFromHeic: boolean;
}

export function isAllowedOrderPhoto(file: {
  mimetype?: string | null;
  originalname?: string | null;
}): boolean {
  const mime = (file.mimetype ?? '').toLowerCase();
  if (STORABLE_MIME_TYPES.has(mime) || HEIF_MIME_TYPES.has(mime)) {
    return true;
  }

  const extension = extname(file.originalname ?? '').toLowerCase();
  if (!ORDER_PHOTO_EXTENSIONS.has(extension)) {
    return false;
  }

  // Desktop Chrome/Windows often label a real .heic as octet-stream, or leave the type empty.
  return mime === '' || mime === 'application/octet-stream';
}

function hasHeifBrand(buffer: Buffer): boolean {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') {
    return false;
  }
  return HEIF_BRANDS.has(buffer.toString('ascii', 8, 12).toLowerCase());
}

function shouldConvertHeif(file: Express.Multer.File): boolean {
  const mime = (file.mimetype ?? '').toLowerCase();
  // A browser that sniffed a real JPEG/PNG/WebP must not be re-encoded — that would drop quality.
  if (STORABLE_MIME_TYPES.has(mime)) {
    return false;
  }
  if (HEIF_MIME_TYPES.has(mime)) {
    return true;
  }
  if (HEIF_EXTENSIONS.has(extname(file.originalname ?? '').toLowerCase())) {
    return true;
  }
  return hasHeifBrand(file.buffer);
}

function passthrough(file: Express.Multer.File): PreparedOrderPhoto {
  return {
    buffer: file.buffer,
    mimetype: file.mimetype,
    extension: null,
    width: null,
    height: null,
    convertedFromHeic: false,
  };
}

async function sniffBrowserImage(
  buffer: Buffer,
): Promise<{ mimetype: string; extension: string } | null> {
  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    if (meta.format === 'jpeg') {
      return { mimetype: 'image/jpeg', extension: '.jpg' };
    }
    if (meta.format === 'png') {
      return { mimetype: 'image/png', extension: '.png' };
    }
    if (meta.format === 'webp') {
      return { mimetype: 'image/webp', extension: '.webp' };
    }
    return null;
  } catch {
    return null;
  }
}

async function convertHeifToJpeg(
  buffer: Buffer,
  originalName?: string,
): Promise<PreparedOrderPhoto> {
  const decoded = await decodeHeic({ buffer });
  const pixels = decoded.width * decoded.height;
  if (!decoded.width || !decoded.height || decoded.data.length !== pixels * 4) {
    throw new Error('HEIC decode returned an unexpected pixel buffer');
  }
  if (pixels > MAX_HEIC_PIXELS) {
    throw new BadRequestException(orderPhotoHeicTooLargeMessage(originalName));
  }

  // display() in libheif already applies irot/imir, so the JPEG must not be rotated again.
  // flatten() only changes pixels that are actually transparent; phone photos are opaque.
  const jpeg = await sharp(Buffer.from(decoded.data), {
    raw: { width: decoded.width, height: decoded.height, channels: 4 },
    limitInputPixels: MAX_HEIC_PIXELS,
  })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: ORDER_PHOTO_JPEG_QUALITY, chromaSubsampling: '4:4:4' })
    .toBuffer();

  return {
    buffer: jpeg,
    mimetype: 'image/jpeg',
    extension: '.jpg',
    width: decoded.width,
    height: decoded.height,
    convertedFromHeic: true,
  };
}

/**
 * JPEG, PNG and WebP pass through untouched. HEIC/HEIF (iPhone) become a high-quality JPEG
 * so every browser, Konva and the print screenshot can show the photo.
 */
export async function prepareOrderPhoto(file: Express.Multer.File): Promise<PreparedOrderPhoto> {
  if (!shouldConvertHeif(file)) {
    return passthrough(file);
  }

  try {
    return await convertHeifToJpeg(file.buffer, file.originalname);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    // `.heic` extension on a file that is actually JPEG/PNG/WebP — store the original bytes.
    const sniffed = await sniffBrowserImage(file.buffer);
    if (sniffed) {
      return {
        buffer: file.buffer,
        mimetype: sniffed.mimetype,
        extension: sniffed.extension,
        width: null,
        height: null,
        convertedFromHeic: false,
      };
    }
    throw new BadRequestException(orderPhotoHeicFailedMessage(file.originalname));
  }
}
