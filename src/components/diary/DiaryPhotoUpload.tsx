import { useState, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Camera, CalendarIcon, Loader2, X, Upload, RefreshCw, WifiOff, Cloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { compressImage, capturePhotoMetadata } from "@/lib/imageCompression";
import { useQueryClient } from "@tanstack/react-query";
import { addToQueue, getAllItems, getPendingCount, updateItemStatus, removeItem, type QueueItem } from "@/lib/offlinePhotoQueue";
import { processSyncQueue } from "@/lib/photoSyncService";

interface DiaryPhotoUploadProps {
  entryId: string;
  projectId: string;
  companyId: string;
  contracts?: { id: string; name: string }[];
  onComplete?: () => void;
}

interface PendingFile {
  file: File;
  preview: string;
  displayName: string;
  capturedAt: Date;
  description: string;
  activity: string;
  contractId: string;
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function DiaryPhotoUpload({ entryId, projectId, companyId, contracts = [], onComplete }: DiaryPhotoUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // IndexedDB queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueue = useCallback(async () => {
    const all = await getAllItems();
    const forThisEntry = all.filter((i) => i.rdoDiaId === entryId && i.status !== "done");
    setQueueItems(forThisEntry);
    const count = await getPendingCount();
    setPendingCount(count);
  }, [entryId]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPending: PendingFile[] = files.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      displayName: f.name.replace(/\.[^/.]+$/, ""),
      capturedAt: new Date(),
      description: "",
      activity: "",
      contractId: "",
    }));
    setPending((prev) => [...prev, ...newPending]);
    if (inputRef.current) inputRef.current.value = "";

    // Queue each file immediately to IndexedDB
    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressed);
        });

        const fileName = `${crypto.randomUUID()}.jpg`;
        const placeholderMeta = {
          captured_at: new Date().toISOString(),
          latitude: null,
          longitude: null,
          accuracy_meters: null,
          address: null,
          weather_description: null,
          device_info: navigator.userAgent.substring(0, 200),
        };

        const localId = await addToQueue({
          rdoDiaId: entryId,
          companyId,
          base64,
          mimeType: "image/jpeg",
          fileName,
          metadata: placeholderMeta,
        });

        capturePhotoMetadata().then(async (meta) => {
          const all = await getAllItems();
          const queuedItem = all.find((i) => i.localId === localId);
          if (queuedItem) {
            await removeItem(localId);
            await addToQueue({
              rdoDiaId: queuedItem.rdoDiaId,
              companyId: queuedItem.companyId,
              base64: queuedItem.base64,
              mimeType: queuedItem.mimeType,
              fileName: queuedItem.fileName,
              metadata: meta,
            });
          }
          await refreshQueue();
        }).catch(() => {});

        await refreshQueue();

        if (!navigator.onLine) {
          sonnerToast.warning("Foto salva localmente. Será enviada quando houver sinal.", {
            icon: "📵",
            duration: 4000,
          });
        } else {
          processSyncQueue(supabase).then(() => {
            queryClient.invalidateQueries({ queryKey: ["diary_photos"] });
            refreshQueue();
          });
        }
      } catch (err) {
        console.error("Failed to queue diary photo:", err);
      }
    }
  };

  const removePending = (idx: number) => {
    setPending((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updatePending = (idx: number, field: keyof PendingFile, value: string) => {
    setPending((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const hasEmptyNames = pending.some((p) => !p.displayName.trim());

  const uploadAll = async () => {
    if (!user || pending.length === 0) return;
    if (hasEmptyNames) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Preencha o nome de todas as fotos antes de enviar." });
      return;
    }
    setUploading(true);
    setProgress(0);

    let uploaded = 0;

    for (const item of pending) {
      try {
        let fileToUpload: File;
        let mimeType: string;
        try {
          fileToUpload = await compressImage(item.file);
          mimeType = fileToUpload.type || "image/jpeg";
        } catch {
          fileToUpload = item.file;
          mimeType = item.file.type || "application/octet-stream";
        }
        const ext = mimeType === "image/jpeg" ? "jpg" : (mimeType.split("/")[1] || "bin");
        const path = `${user.id}/${entryId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("diary-photos")
          .upload(path, fileToUpload, { contentType: mimeType });

        if (uploadErr) throw uploadErr;

        const { error: metaErr } = await supabase.from("diary_photos").insert({
          diary_entry_id: entryId,
          company_id: companyId,
          project_id: projectId,
          uploaded_by: user.id,
          storage_path: path,
          file_name: item.displayName || item.file.name,
          file_size: fileToUpload.size,
          mime_type: mimeType,
          description: item.description || null,
          activity: item.activity || null,
          contract_id: item.contractId || null,
          latitude: null,
          longitude: null,
          captured_at: item.capturedAt.toISOString(),
        });

        if (metaErr) throw metaErr;
        uploaded++;
      } catch (err: any) {
        console.error("Upload error:", err);
        toast({ variant: "destructive", title: "Erro no upload", description: `${item.file.name}: ${err.message}` });
      }
      setProgress(Math.round((uploaded / pending.length) * 100));
    }

    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
    setUploading(false);
    setProgress(0);
    queryClient.invalidateQueries({ queryKey: ["diary_photos"] });
    toast({ title: `${uploaded} foto(s) enviada(s) com sucesso!` });
    onComplete?.();
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    await processSyncQueue(supabase);
    queryClient.invalidateQueries({ queryKey: ["diary_photos"] });
    await refreshQueue();
    setIsSyncing(false);
  };

  const handleRetryItem = async (item: QueueItem) => {
    if (!item.localId) return;
    await updateItemStatus(item.localId, "pending");
    await refreshQueue();
    await handleSyncNow();
  };

  return (
    <div className="space-y-4">
      {/* Pending count banner */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>Você tem <strong>{pendingCount}</strong> foto(s) salva(s) localmente aguardando envio.</span>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={handleSyncNow} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span className="ml-1">Sincronizar agora</span>
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Camera className="mr-2 h-4 w-4" />
          Selecionar Fotos
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
        {pending.length > 0 && (
          <span className="text-sm text-muted-foreground">{pending.length} foto(s) selecionada(s)</span>
        )}
      </div>

      {/* Queued items from IndexedDB */}
      {queueItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Fotos na fila local:</p>
          <div className="grid grid-cols-3 gap-2">
            {queueItems.map((item) => (
              <div key={`q-${item.localId}`} className="relative rounded-md overflow-hidden border border-dashed border-yellow-300 dark:border-yellow-700 aspect-square">
                {item.base64 ? (
                  <img src={item.base64} alt={item.fileName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
                <div className="absolute top-1 left-1">
                  {item.status === "error" ? (
                    <Badge className="text-[8px] h-4 bg-red-500/10 text-red-700">Erro</Badge>
                  ) : item.status === "uploading" ? (
                    <Badge className="text-[8px] h-4 bg-blue-500/10 text-blue-700">Enviando...</Badge>
                  ) : (
                    <Badge className="text-[8px] h-4 bg-yellow-500/10 text-yellow-700">Pendente</Badge>
                  )}
                </div>
                {item.status === "error" && (item.attempts || 0) <= 3 && (
                  <button onClick={() => handleRetryItem(item)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 cursor-pointer">
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
                {Date.now() - new Date(item.createdAt).getTime() > TWENTY_FOUR_HOURS && (
                  <div className="absolute bottom-0 inset-x-0 bg-amber-500/80 px-1 py-0.5">
                    <p className="text-[8px] text-white text-center">+24h pendente</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {pending.map((item, idx) => (
            <div key={idx} className="flex gap-3 p-3 rounded-lg border bg-card">
              <div className="relative w-20 h-20 shrink-0">
                <img src={item.preview} alt="" className="w-full h-full object-cover rounded-md" />
                <button
                  type="button"
                  onClick={() => removePending(idx)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Nome da foto</Label>
                    <Input
                      value={item.displayName}
                      onChange={(e) => updatePending(idx, "displayName", e.target.value)}
                      className={cn("h-8 text-sm", !item.displayName.trim() && "border-destructive")}
                      placeholder="Nome da foto"
                    />
                  </div>
                  <div className="w-40">
                    <Label className="text-xs text-muted-foreground">Data da captura</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-8 w-full justify-start text-left text-sm font-normal", !item.capturedAt && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {format(item.capturedAt, "dd/MM/yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={item.capturedAt}
                          onSelect={(date) => {
                            if (date) {
                              setPending((prev) => prev.map((p, i) => i === idx ? { ...p, capturedAt: date } : p));
                            }
                          }}
                          locale={ptBR}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Input
                  placeholder="Descrição técnica da foto"
                  value={item.description}
                  onChange={(e) => updatePending(idx, "description", e.target.value)}
                  className="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Atividade/serviço"
                    value={item.activity}
                    onChange={(e) => updatePending(idx, "activity", e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  {contracts.length > 0 && (
                    <Select value={item.contractId} onValueChange={(v) => updatePending(idx, "contractId", v)}>
                      <SelectTrigger className="h-8 text-sm w-40">
                        <SelectValue placeholder="Contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploading && <Progress value={progress} className="h-2" />}

      {pending.length > 0 && (
        <Button onClick={uploadAll} disabled={uploading} className="w-full">
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando... {progress}%
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Enviar {pending.length} foto(s)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
