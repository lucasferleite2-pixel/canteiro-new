import { toast } from "sonner";

/**
 * Compresses an image file while maintaining quality.
 * Returns a new File with reduced size.
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Skip non-image files
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          const compressed = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Instead of rejecting, return the original file so upload isn't blocked
      console.warn("Image compression failed to load image, using original file");
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Extract GPS coordinates from image EXIF data (if available).
 * Returns null if not available (simplified - browser doesn't expose EXIF natively).
 */
export async function getGPSFromBrowser(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

export interface PhotoMetadataResult {
  captured_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  address: string | null;
  weather_description: string | null;
  device_info: string;
}

export type PhotoMetadata = PhotoMetadataResult;

/**
 * Draws metadata as a stamp overlay on the bottom of an image using the Canvas API.
 * Works on iOS Safari and Chrome Android.
 * If canvas fails for any reason, returns the original file unchanged.
 */
export async function stampPhotoWithMetadata(
  file: File,
  metadata: PhotoMetadata
): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }

        ctx.drawImage(img, 0, 0);

        const barHeight = 80;
        const yBar = canvas.height - barHeight;

        // Semi-transparent dark bar
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, yBar, canvas.width, barHeight);

        const padZero = (n: number) => String(n).padStart(2, "0");
        const d = new Date(metadata.captured_at);
        const dateStr = `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()} ${padZero(d.getHours())}:${padZero(d.getMinutes())}`;

        const px = 12;
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "top";

        // Line 1 (left): date — bold 14px
        ctx.font = "bold 14px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`📅 ${dateStr}`, px, yBar + 8);

        // Line 2 (left): address — 12px
        const address = metadata.address ?? "Capturando localização...";
        ctx.font = "12px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`📍 ${address}`, px, yBar + 30);

        // Line 3 (left): weather — 12px
        if (metadata.weather_description) {
          ctx.fillText(`🌤 ${metadata.weather_description}`, px, yBar + 50);
        }

        // Bottom-right corner: branding — 10px, opacity 0.7
        ctx.globalAlpha = 0.7;
        ctx.font = "10px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText("ERP Obra Inteligente", canvas.width - px, canvas.height - 6);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const stamped = new File([blob], `${baseName}_stamped.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(stamped);
          },
          "image/jpeg",
          0.9
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

const WEATHER_CODES: Array<[number[], string]> = [
  [[0], "Céu limpo"],
  [[1, 2, 3], "Parcialmente nublado"],
  [[45, 46, 47, 48], "Neblina"],
  [[51, 52, 53, 54, 55, 56, 57, 61, 63, 65, 66, 67], "Chuva leve/moderada"],
  [[71, 72, 73, 74, 75, 76, 77], "Neve"],
  [[80, 81, 82], "Chuva"],
  [[95, 96, 99], "Tempestade"],
];

function mapWeatherCode(code: number): string {
  for (const [codes, label] of WEATHER_CODES) {
    if (codes.includes(code)) return label;
  }
  return "Condição desconhecida";
}

/**
 * Captures rich photo metadata in parallel:
 * GPS, reverse geocoding (Nominatim), weather (Open-Meteo), device info.
 * Never blocks — GPS failure returns nulls.
 */
export async function capturePhotoMetadata(): Promise<PhotoMetadataResult> {
  const toastId = toast.loading("Capturando localização...", { duration: 8000 });

  const captured_at = new Date().toISOString();
  const device_info = navigator.userAgent.substring(0, 200);

  // GPS
  const gps = await new Promise<GeolocationPosition | null>((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
    );
  });

  toast.dismiss(toastId);

  if (!gps) {
    return { captured_at, latitude: null, longitude: null, accuracy_meters: null, address: null, weather_description: null, device_info };
  }

  const { latitude, longitude, accuracy } = gps.coords;

  // Parallel: reverse geocoding + weather
  const [geocodeResult, weatherResult] = await Promise.allSettled([
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
      headers: { "Accept-Language": "pt-BR" },
    }).then((r) => r.json()),
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`).then((r) => r.json()),
  ]);

  let address: string | null = null;
  if (geocodeResult.status === "fulfilled") {
    const geo = geocodeResult.value;
    const city = geo?.address?.city || geo?.address?.town || geo?.address?.village || geo?.address?.county || "";
    const state = geo?.address?.state || "";
    address = [city, state].filter(Boolean).join(", ") || geo?.display_name?.split(",").slice(0, 2).join(", ") || null;
  }

  let weather_description: string | null = null;
  if (weatherResult.status === "fulfilled") {
    const w = weatherResult.value?.current_weather;
    if (w) {
      const desc = mapWeatherCode(w.weathercode);
      weather_description = `${desc}, ${Math.round(w.temperature)}°C`;
    }
  }

  return {
    captured_at,
    latitude,
    longitude,
    accuracy_meters: accuracy != null ? Math.round(accuracy * 10) / 10 : null,
    address,
    weather_description,
    device_info,
  };
}
