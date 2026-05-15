// ============================================================
// lib/storage/compress.ts — Browser-only image compression
//
// Wraps `browser-image-compression` with the project's compression
// profiles. Runs on the user's machine before any bytes leave the
// browser — we never compress server-side because:
//   1. It's fast on the device (no extra server round-trip)
//   2. It saves bandwidth on mobile connections
//   3. It keeps server CPU free for real work
//
// Usage from a client component
// -----------------------------
// const compressed = await compressImage(file, 'logo');
// // `compressed` is a new File with the same `name`, a possibly
// // different MIME type, and much smaller `size`. Pass it to the
// // upload server action via FormData.
// ============================================================
'use client';

import imageCompression from 'browser-image-compression';
import { COMPRESSION_PROFILES, type CompressionProfile } from './constants';

/**
 * Compress an image file using the named profile. Returns a new
 * `File` with the compressed bytes. The file name is preserved
 * (minus the extension, which may change if we re-encoded to WebP).
 *
 * @throws if the source is not an image or if compression fails.
 *         Callers should catch and fall back to the raw file only
 *         after confirming it's under the bucket's hard cap.
 */
export async function compressImage(
  file: File,
  profileName: CompressionProfile,
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`Not an image file: ${file.type}`);
  }

  // SVG is vector — compressing raster-style loses it. Skip and return
  // as-is; the bucket still accepts it and it's already tiny.
  if (file.type === 'image/svg+xml') {
    return file;
  }

  const profile = COMPRESSION_PROFILES[profileName];

  // Preserve transparency if the source is PNG. Otherwise prefer WebP —
  // the profile's preferType. The library picks based on `fileType`.
  const keepPngTransparency = file.type === 'image/png';
  const outputType = keepPngTransparency ? 'image/png' : profile.preferType;

  const compressed = await imageCompression(file, {
    maxSizeMB:            profile.maxSizeKB / 1024,
    maxWidthOrHeight:     profile.maxWidth,
    fileType:             outputType,
    useWebWorker:         true,
    // post-image: 0.95 — visually lossless, original dimensions preserved.
    // logo / in-doc-image: 0.8 — smaller output acceptable for UI assets.
    initialQuality:       profileName === 'post-image' ? 0.95 : 0.8,
  });

  // `browser-image-compression` returns Blob on some paths — normalize
  // to File so the caller can pass it straight to FormData with a name.
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newExt   = extensionForMime(outputType);
  return new File([compressed], `${baseName}.${newExt}`, { type: outputType });
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/png':  return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/webp': return 'webp';
    default:           return 'bin';
  }
}
