import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FolderOpen, Upload, Trash2, ExternalLink, Loader2, FileText, Image, File } from "lucide-react";

const CATEGORIES = ["geral", "planta", "contrato", "foto", "memorial", "ART", "outro"];

function FileIcon({ fileType }: { fileType?: string }) {
  if (!fileType) return <File className="h-8 w-8 text-muted-foreground" />;
  if (fileType.startsWith("image/")) return <Image className="h-8 w-8 text-blue-500" />;
  if (fileType.includes("pdf")) return <FileText className="h-8 w-8 text-red-500" />;
  return <File className="h-8 w-8 text-muted-foreground" />;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GestaoArquivos() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [uploadForm, setUploadForm] = useState({ name: "", category: "geral", description: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["project_files", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase.from("project_files").select("*").eq("project_id", selectedProject).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const handleUpload = async () => {
    if (!selectedFile || !companyId || !selectedProject) return;
    setUploading(true);
    try {
      const ext = selectedFile.name.split(".").pop();
      const path = `${companyId}/${selectedProject}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("project-files").upload(path, selectedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("project-files").getPublicUrl(path);

      const { error: insertError } = await supabase.from("project_files").insert({
        company_id: companyId,
        project_id: selectedProject,
        name: uploadForm.name || selectedFile.name,
        file_url: publicUrl,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        category: uploadForm.category,
        description: uploadForm.description,
        uploaded_by: user?.id,
      });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["project_files"] });
      setDialogOpen(false);
      setSelectedFile(null);
      setUploadForm({ name: "", category: "geral", description: "" });
      toast({ title: "Arquivo enviado com sucesso!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro no upload", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_files"] });
      setDeleteId(null);
      toast({ title: "Arquivo excluído!" });
    },
  });

  const filteredFiles = files.filter((f: any) => categoryFilter === "all" || f.category === categoryFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Arquivos</h1>
          <p className="text-muted-foreground text-sm">Documentos e arquivos por projeto.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={!selectedProject}>
          <Upload className="mr-2 h-4 w-4" /> Upload
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Projeto:</Label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
            <SelectContent>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selectedProject && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedProject ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Selecione um projeto para gerenciar arquivos.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filteredFiles.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16">
          <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum arquivo encontrado.</p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFiles.map((f: any) => (
            <Card key={f.id} className="group">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-center">
                  <FileIcon fileType={f.file_type} />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium truncate" title={f.name}>{f.name}</p>
                  <Badge variant="outline" className="text-xs">{f.category}</Badge>
                  {f.file_size && <p className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex gap-1 justify-center">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(f.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arquivo *</Label>
              <input ref={fileInputRef} type="file" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setSelectedFile(f); if (!uploadForm.name) setUploadForm(prev => ({ ...prev, name: f.name })); }
              }} />
              <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {selectedFile ? selectedFile.name : "Selecionar arquivo"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do arquivo" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={uploadForm.category} onValueChange={v => setUploadForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
