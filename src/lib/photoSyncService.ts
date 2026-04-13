/**
 * Photo sync service — uploads queued photos from IndexedDB to Supabase.
 *
 * NOTE: The Supabase Storage bucket "rdo-photos" must exist and have a public
 * access policy before this service can upload. Create it manually in the
 * Supabase dashboard (Storage → New bucket → name: "rdo-photos" → Public).
 */

import { getPendingItems, updateItemStatus, removeItem } from "./offlinePhotoQueue";
export { getPendingCount } from "./offlinePhotoQueue";

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.includes(",") ? base64.split(",")[1] : base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: mimeType });
}

export async function processSyncQueue(supabaseClient: any): Promise<void> {
  const items = await getPendingItems();
  if (items.length === 0) return;

  for (const item of items) {
    if (!item.localId) continue;
    if ((item.attempts || 0) > 3) continue;

    await updateItemStatus(item.localId, "uploading");

    try {
      const blob = base64ToBlob(item.base64, item.mimeType);
      const path = `${item.companyId}/${item.rdoDiaId}/${item.fileName}`;

      const { error: storageErr } = await supabaseClient.storage
        .from("rdo-photos")
        .upload(path, blob, { contentType: item.mimeType, upsert: true });

      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabaseClient.from("rdo_foto").insert({
        rdo_dia_id: item.rdoDiaId,
        company_id: item.companyId,
        file_name: item.fileName,
        storage_path: path,
        captured_at: item.metadata.captured_at || null,
        latitude: item.metadata.latitude,
        longitude: item.metadata.longitude,
        accuracy_meters: item.metadata.accuracy_meters,
        address: item.metadata.address,
        weather_description: item.metadata.weather_description,
        device_info: item.metadata.device_info,
      });

      if (dbErr) throw dbErr;

      await removeItem(item.localId);
    } catch (err: any) {
      await updateItemStatus(item.localId, "error", err?.message || "Erro desconhecido");
    }
  }
}

let _syncStarted = false;

export function startSyncService(supabaseClient: any, _userId: string): void {
  if (_syncStarted) return;
  _syncStarted = true;

  const sync = () => processSyncQueue(supabaseClient);

  window.addEventListener("online", sync);

  if (navigator.onLine) {
    sync();
  }
}
