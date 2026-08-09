export function shortId(id: string) {
  return `REQ-${id.slice(0, 6).toUpperCase()}`;
}

export function timeLeft(endsAt: string, lang: "en" | "ar") {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (lang === "ar") return `${hours} ساعة ${minutes} دقيقة`;
  return `${hours}h ${minutes}m`;
}

export function estimatedDelivery(createdAt: string, days: number, lang: "en" | "ar") {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + (days || 3));
  return d.toLocaleDateString(lang === "ar" ? "ar" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Prototype-friendly image handling: downscale to a compact data URL, no storage needed. */
export function fileToCompactDataUrl(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Prototype-only video handling: embeds the raw file as a data URL, capped
 * at 8MB. This is fine for short demo clips but NOT how real product videos
 * should be stored — before going live, swap this for an upload to a proper
 * Supabase Storage bucket and store the resulting URL instead.
 */
export function videoFileToDataUrl(file: File, maxBytes = 8 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`Video is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB for this prototype)`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
