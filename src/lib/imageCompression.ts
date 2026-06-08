/**
 * Client-side image compression to drastically reduce Supabase storage egress.
 *
 * - Resizes images to a max long-edge (default 1600px)
 * - Re-encodes to WebP (or keeps PNG for transparency-critical buckets)
 * - Iteratively lowers quality to fit a target byte budget (default 1MB)
 * - Returns the original File untouched for non-image files (PDF, video, etc.)
 */

export interface CompressOptions {
  /** Max pixel size of the longest edge. Default 1600. */
  maxDimension?: number;
  /** Target max size in bytes after compression. Default 1MB. */
  targetBytes?: number;
  /** Preserve PNG output for transparency (used for stickers, badges with alpha). */
  preservePng?: boolean;
  /** Output mime hint (image/webp default). */
  outputType?: "image/webp" | "image/jpeg" | "image/png";
}

const DEFAULTS: Required<Omit<CompressOptions, "outputType">> & { outputType: string } = {
  maxDimension: 1600,
  targetBytes: 1024 * 1024,
  preservePng: false,
  outputType: "image/webp",
};

const HARD_RAW_LIMIT = 25 * 1024 * 1024; // 25MB raw input cap to avoid OOM

async function fileToBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to img element
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * Compress an image File. Returns the original File if it is not an image,
 * is already small enough, or compression fails for any reason.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  if (!file || !file.type.startsWith("image/")) return file;
  // GIF/SVG: keep as-is (animation / vector) but enforce raw size cap.
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    if (file.size > HARD_RAW_LIMIT) throw new Error("Il file supera il limite massimo (25MB).");
    return file;
  }
  if (file.size > HARD_RAW_LIMIT) throw new Error("Il file supera il limite massimo (25MB).");

  const isPng = file.type === "image/png";
  const outputType = opts.preservePng && isPng ? "image/png" : opts.outputType;
  // Already small enough and correct type → skip work
  if (file.size <= opts.targetBytes && (file.type === outputType || (isPng && opts.preservePng))) {
    return file;
  }

  try {
    const bitmap = await fileToBitmap(file);
    const srcW = (bitmap as ImageBitmap).width || (bitmap as HTMLImageElement).naturalWidth;
    const srcH = (bitmap as ImageBitmap).height || (bitmap as HTMLImageElement).naturalHeight;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, opts.maxDimension / Math.max(srcW, srcH));
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);

    // PNG output cannot be controlled by quality — try once.
    if (outputType === "image/png") {
      const blob = await canvasToBlob(canvas, "image/png", 1);
      if (!blob) return file;
      return blobToFile(blob, file.name, "image/png");
    }

    // Iterative quality reduction targeting opts.targetBytes
    const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];
    let best: Blob | null = null;
    for (const q of qualities) {
      const blob = await canvasToBlob(canvas, outputType, q);
      if (!blob) continue;
      best = blob;
      if (blob.size <= opts.targetBytes) break;
    }
    if (!best) return file;
    // If even q=0.35 is too big and source was huge, accept it (still smaller than raw)
    return blobToFile(best, file.name, outputType);
  } catch {
    return file;
  }
}

function blobToFile(blob: Blob, originalName: string, outputType: string): File {
  const ext = outputType === "image/webp" ? "webp" : outputType === "image/png" ? "png" : "jpg";
  const base = originalName.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.${ext}`, { type: outputType });
}

/**
 * Convenience wrapper for upload sites: validates type, compresses, and
 * returns either the new File or throws a user-friendly error.
 */
export async function prepareImageForUpload(file: File, options: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith("image/")) {
    // Non-image: still enforce a sensible raw cap of 25MB.
    if (file.size > HARD_RAW_LIMIT) throw new Error("Il file supera il limite massimo (25MB).");
    return file;
  }
  return compressImage(file, options);
}
