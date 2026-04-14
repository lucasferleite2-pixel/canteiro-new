import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Project = { id: string; name: string; status: string | null };

type PendingPhoto = {
  id: string;
  obra_id: string | null;
  thumbnail?: string;
  description?: string;
  queued_at: string;
};

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function getPendingPhotos(): PendingPhoto[] {
  try {
    const raw = localStorage.getItem("photoQueue");
    if (!raw) return [];
    return JSON.parse(raw) as PendingPhoto[];
  } catch {
    return [];
  }
}

export default function Campo() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const time = useCurrentTime();
  const [selectedObra, setSelectedObra] = useState<string>("");
  const [showOcorrencia, setShowOcorrencia] = useState(false);
  const [ocorrenciaText, setOcorrenciaText] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("info");
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>(getPendingPhotos());
  const [weather, setWeather] = useState<{ temp: number; condition: string; city: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name,status").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data as Project[];
    },
  });

  // Load weather via GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
        );
        const json = await res.json();
        const wmo = json.current_weather?.weathercode ?? 0;
        const conditions: Record<number, string> = { 0: "Ensolarado", 1: "Poucas nuvens", 2: "Parcialmente nublado", 3: "Nublado", 45: "Névoa", 51: "Chuva fraca", 61: "Chuva moderada", 80: "Pancadas", 95: "Tempestade" };
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const geoJson = await geoRes.json();
        const city = geoJson.address?.city || geoJson.address?.town || geoJson.address?.village || "Campo";
        setWeather({ temp: Math.round(json.current_weather?.temperature ?? 0), condition: conditions[wmo] || "Desconhecido", city });
      } catch {
        // weather not critical
      }
    }, undefined, { timeout: 10000 });
  }, []);

  // Refresh pending photos
  useEffect(() => {
    setPendingPhotos(getPendingPhotos());
  }, []);

  const ocorrenciaMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const { error } = await (supabase as any).from("alerts").insert({
        company_id: companyId,
        title: `Ocorrência no campo — ${severity.toUpperCase()}`,
        message: ocorrenciaText,
        severity,
        project_id: selectedObra || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência registrada");
      setOcorrenciaText("");
      setSeverity("info");
      setShowOcorrencia(false);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleSync() {
    if (!online) { toast.error("Sem conexão"); return; }
    setSyncing(true);
    // Simulate sync — in production this would call the actual sync logic
    await new Promise(r => setTimeout(r, 1500));
    localStorage.removeItem("photoQueue");
    setPendingPhotos([]);
    setSyncing(false);
    toast.success("Fotos sincronizadas");
  }

  function openCamera() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: PendingPhoto = {
          id: crypto.randomUUID(),
          obra_id: selectedObra || null,
          thumbnail: reader.result as string,
          queued_at: new Date().toISOString(),
        };
        const updated = [...getPendingPhotos(), newPhoto];
        localStorage.setItem("photoQueue", JSON.stringify(updated));
        setPendingPhotos(updated);
        toast.success("Foto adicionada à fila");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  const selectedObraObj = projects.find(p => p.id === selectedObra);
  const timeStr = time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = time.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ WebkitUserSelect: "none", userSelect: "none" }}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">Canteiro - Campo</div>
            <div className="text-xs text-gray-400">{dateStr}</div>
          </div>
          <div className="flex items-center gap-3">
            {pendingPhotos.length > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {pendingPhotos.length} foto{pendingPhotos.length !== 1 ? "s" : ""}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${online ? "bg-green-400" : "bg-red-500"}`} />
              <span className="text-xs text-gray-400">{online ? "Online" : "Offline"}</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{timeStr}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Obra selector */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Obra atual</div>
          <Select value={selectedObra || "none"} onValueChange={v => setSelectedObra(v === "none" ? "" : v)}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-14 text-base rounded-xl">
              <SelectValue placeholder="Selecionar obra..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="none" className="text-gray-400">Selecionar obra...</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-white">
                  <div className="flex items-center gap-2">
                    <span>{p.name}</span>
                    {p.status && <span className="text-xs text-gray-400 capitalize">{p.status}</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Weather */}
        {weather && (
          <div className="bg-blue-900/40 border border-blue-800/50 rounded-2xl p-3 flex items-center gap-3">
            <div>
              <div className="text-lg font-bold">{weather.temp}°C</div>
              <div className="text-xs text-blue-300">{weather.city} · {weather.condition}</div>
            </div>
          </div>
        )}

        {/* Quick actions 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={openCamera}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl p-5 text-center transition-colors min-h-[100px] flex flex-col items-center justify-center gap-2"
          >
            <span className="text-4xl">📷</span>
            <span className="text-sm font-bold">Nova Foto</span>
          </button>

          <button
            onClick={() => navigate("/diario")}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-2xl p-5 text-center transition-colors min-h-[100px] flex flex-col items-center justify-center gap-2"
          >
            <span className="text-4xl">📝</span>
            <span className="text-sm font-bold">Novo RDO</span>
          </button>

          <button
            onClick={() => navigate("/diario")}
            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-2xl p-5 text-center transition-colors min-h-[100px] flex flex-col items-center justify-center gap-2"
          >
            <span className="text-4xl">📋</span>
            <span className="text-sm font-bold">Ver Diário</span>
          </button>

          <button
            onClick={() => setShowOcorrencia(true)}
            className="bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-2xl p-5 text-center transition-colors min-h-[100px] flex flex-col items-center justify-center gap-2"
          >
            <span className="text-4xl">⚠️</span>
            <span className="text-sm font-bold">Ocorrência</span>
          </button>
        </div>

        {/* Pending photos */}
        {pendingPhotos.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-orange-400">{pendingPhotos.length} foto{pendingPhotos.length !== 1 ? "s" : ""} pendente{pendingPhotos.length !== 1 ? "s" : ""}</div>
              <Button
                onClick={handleSync}
                disabled={!online || syncing}
                className="bg-orange-500 hover:bg-orange-400 text-white h-9 text-xs rounded-xl"
              >
                {syncing ? "Sincronizando..." : "Sincronizar agora"}
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pendingPhotos.map((p) => (
                p.thumbnail ? (
                  <img key={p.id} src={p.thumbnail} alt="foto pendente" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-700" />
                ) : (
                  <div key={p.id} className="w-16 h-16 rounded-lg bg-gray-800 shrink-0 flex items-center justify-center text-2xl border border-gray-700">📷</div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Occurrence bottom sheet */}
        {showOcorrencia && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowOcorrencia(false)}>
            <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1.5 bg-gray-700 rounded-full mx-auto mb-2" />
              <h2 className="text-lg font-bold">Registrar Ocorrência</h2>
              {selectedObraObj && (
                <div className="text-xs text-gray-400">Obra: {selectedObraObj.name}</div>
              )}
              <Textarea
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 rounded-xl text-base resize-none"
                rows={4}
                placeholder="Descreva a ocorrência..."
                value={ocorrenciaText}
                onChange={e => setOcorrenciaText(e.target.value)}
                autoFocus
              />
              <div>
                <div className="text-xs text-gray-400 mb-2">Severidade</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["info", "warning", "critical"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSeverity(s)}
                      className={`rounded-xl py-3 text-sm font-bold transition-colors ${
                        severity === s
                          ? s === "info" ? "bg-blue-600" : s === "warning" ? "bg-orange-500" : "bg-red-600"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {s === "info" ? "Info" : s === "warning" ? "Alerta" : "Crítico"}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full h-14 text-base font-bold rounded-xl"
                disabled={!ocorrenciaText.trim() || ocorrenciaMutation.isPending}
                onClick={() => ocorrenciaMutation.mutate()}
              >
                {ocorrenciaMutation.isPending ? "Registrando..." : "Registrar Ocorrência"}
              </Button>
              <button className="w-full text-gray-500 text-sm py-2" onClick={() => setShowOcorrencia(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="text-sm text-blue-400 underline">Versão completa</button>
        <span className="text-xs text-gray-600">v1.0 · Campo</span>
      </div>
    </div>
  );
}
