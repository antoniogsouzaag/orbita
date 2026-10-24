/** Recorta no centro (quadrado), reduz e converte para WebP no próprio navegador. */
export async function toSquareDataUrl(file: File, max = 320): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(max, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.88);
}
