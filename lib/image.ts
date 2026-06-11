"use client";

// Client-side image downscale + re-encode. Used wherever the browser
// hands us a user-picked image we're about to ship over the network:
// the feedback screenshot attachment and the meme translator upload.
//
// Capping the long edge and re-encoding as JPEG keeps the request well
// under platform body limits (and, for feedback, Telegram's photo cap),
// and means we never ship the original — often huge, possibly HEIC —
// bytes. Returns a `data:image/jpeg;base64,…` URL.
const MAX_IMAGE_DIM = 1600;
const IMAGE_QUALITY = 0.8;

export function fileToCompressedDataUrl(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<string> {
  const maxDim = opts.maxDim ?? MAX_IMAGE_DIM;
  const quality = opts.quality ?? IMAGE_QUALITY;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a readable image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Couldn't process the image"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
