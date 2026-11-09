import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import type SharpType from 'sharp';
import {
  HEIC_CONVERT_FAILED_MESSAGE,
  isAllowedOrderPhoto,
  prepareOrderPhoto,
} from './prepare-order-photo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof SharpType = require('sharp');

// Real iPhone 7 still (512×300) from the OpenImageIO HEIF test suite. sharp's prebuilt
// libvips cannot decode it (no libde265); this fixture proves the WASM path can.
const IPHONE_HEIC = readFileSync(join(__dirname, 'fixtures', 'iphone7-small.heic'));

function asUpload(
  buffer: Buffer,
  fields: { mimetype: string; originalname: string },
): Express.Multer.File {
  return {
    buffer,
    mimetype: fields.mimetype,
    originalname: fields.originalname,
    size: buffer.length,
    fieldname: 'file',
  } as Express.Multer.File;
}

describe('isAllowedOrderPhoto', () => {
  it('accepts the formats the upload hint lists, including unlabeled HEIC', () => {
    expect(isAllowedOrderPhoto({ mimetype: 'image/jpeg', originalname: 'a.jpg' })).toBe(true);
    expect(isAllowedOrderPhoto({ mimetype: 'image/jpg', originalname: 'a.jpeg' })).toBe(true);
    expect(isAllowedOrderPhoto({ mimetype: 'image/png', originalname: 'a.png' })).toBe(true);
    expect(isAllowedOrderPhoto({ mimetype: 'image/webp', originalname: 'a.webp' })).toBe(true);
    expect(isAllowedOrderPhoto({ mimetype: 'image/heic', originalname: 'IMG.HEIC' })).toBe(true);
    expect(isAllowedOrderPhoto({ mimetype: 'image/heif', originalname: 'a.heif' })).toBe(true);
    expect(isAllowedOrderPhoto({ mimetype: 'image/heic-sequence', originalname: 'a.heic' })).toBe(
      true,
    );
    expect(
      isAllowedOrderPhoto({ mimetype: 'application/octet-stream', originalname: 'IMG_0001.HEIC' }),
    ).toBe(true);
    expect(isAllowedOrderPhoto({ mimetype: '', originalname: 'photo.heif' })).toBe(true);
  });

  it('rejects formats the pipeline cannot store or print', () => {
    expect(isAllowedOrderPhoto({ mimetype: 'image/gif', originalname: 'a.gif' })).toBe(false);
    expect(isAllowedOrderPhoto({ mimetype: 'application/pdf', originalname: 'a.pdf' })).toBe(false);
    expect(
      isAllowedOrderPhoto({ mimetype: 'application/octet-stream', originalname: 'a.exe' }),
    ).toBe(false);
  });
});

describe('prepareOrderPhoto', () => {
  it('leaves JPEG and PNG bytes untouched', async () => {
    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer();
    const preparedJpeg = await prepareOrderPhoto(
      asUpload(jpeg, { mimetype: 'image/jpeg', originalname: 'plain.jpg' }),
    );
    expect(preparedJpeg.convertedFromHeic).toBe(false);
    expect(preparedJpeg.buffer).toBe(jpeg);
    expect(preparedJpeg.mimetype).toBe('image/jpeg');
    expect(preparedJpeg.extension).toBeNull();
    expect(preparedJpeg.width).toBeNull();

    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    const preparedPng = await prepareOrderPhoto(
      asUpload(png, { mimetype: 'image/png', originalname: 'plain.png' }),
    );
    expect(preparedPng.buffer).toBe(png);
    expect(preparedPng.convertedFromHeic).toBe(false);
  });

  it('converts an iPhone HEIC into a high-quality JPEG browsers can display', async () => {
    const prepared = await prepareOrderPhoto(
      asUpload(IPHONE_HEIC, { mimetype: 'image/heic', originalname: 'IMG_7702.HEIC' }),
    );

    expect(prepared.convertedFromHeic).toBe(true);
    expect(prepared.mimetype).toBe('image/jpeg');
    expect(prepared.extension).toBe('.jpg');
    expect(prepared.width).toBe(512);
    expect(prepared.height).toBe(300);
    expect(prepared.buffer.subarray(0, 3).toString('hex')).toBe('ffd8ff');

    const meta = await sharp(prepared.buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(300);
    expect(meta.chromaSubsampling).toBe('4:4:4');

    const stats = await sharp(prepared.buffer).stats();
    expect(stats.channels[0].max).toBeGreaterThan(200);
    expect(stats.channels[0].min).toBeLessThan(40);

    // Re-encoding the master at quality 50 must get smaller — otherwise we did not keep quality 95.
    const softer = await sharp(prepared.buffer).jpeg({ quality: 50 }).toBuffer();
    expect(prepared.buffer.length).toBeGreaterThan(softer.length);
  }, 20_000);

  it('converts HEIC that the browser labeled as octet-stream', async () => {
    const prepared = await prepareOrderPhoto(
      asUpload(IPHONE_HEIC, {
        mimetype: 'application/octet-stream',
        originalname: 'IMG_7702.HEIC',
      }),
    );
    expect(prepared.convertedFromHeic).toBe(true);
    expect(prepared.mimetype).toBe('image/jpeg');
    expect(prepared.width).toBe(512);
  }, 20_000);

  it('stores a JPEG that was only named .heic without re-encoding it', async () => {
    const jpeg = await sharp({
      create: { width: 6, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    const prepared = await prepareOrderPhoto(
      asUpload(jpeg, { mimetype: 'image/heic', originalname: 'mislabeled.heic' }),
    );
    expect(prepared.convertedFromHeic).toBe(false);
    expect(prepared.buffer).toBe(jpeg);
    expect(prepared.mimetype).toBe('image/jpeg');
    expect(prepared.extension).toBe('.jpg');
  });

  it('rejects a file that is not a readable photo', async () => {
    await expect(
      prepareOrderPhoto(
        asUpload(Buffer.from('not a photo'), { mimetype: 'image/heic', originalname: 'bad.heic' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      prepareOrderPhoto(
        asUpload(Buffer.from('not a photo'), { mimetype: 'image/heif', originalname: 'bad.heif' }),
      ),
    ).rejects.toThrow(HEIC_CONVERT_FAILED_MESSAGE);
  });
});
