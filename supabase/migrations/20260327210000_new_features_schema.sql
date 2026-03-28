-- ============================================
-- ERP Obra Inteligente — Novas Funcionalidades
-- Gestão de Projetos, Obras, CRM e Portal
-- ============================================

-- ── GESTÃO DE PROJETOS ──

-- Cronograma de fases de projeto
CREATE TABLE public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  responsible TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','delayed')),
  progress_percent NUMERIC(5,2) DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  color TEXT DEFAULT '#3B82F6',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

-- Tarefas vinculadas a fases
CREATE TABLE public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Biblioteca de produtos/materiais/serviços
CREATE TABLE public.product_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT DEFAULT 'un',
  unit_price NUMERIC(15,2) DEFAULT 0,
  supplier TEXT,
  reference_code TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_library ENABLE ROW LEVEL SECURITY;

-- Templates de projeto
CREATE TABLE public.project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  template_data JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

-- Arquivos vinculados a projetos/obras
CREATE TABLE public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT DEFAULT 'geral',
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- ── GESTÃO DE OBRAS ──

-- Orçamento de obra com composições SINAPI
CREATE TABLE public.obra_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sinapi_code TEXT,
  description TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  quantity NUMERIC(15,4) DEFAULT 0,
  unit_price NUMERIC(15,2) DEFAULT 0,
  total_price NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  category TEXT,
  phase TEXT,
  bdi_percent NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_budget_items ENABLE ROW LEVEL SECURITY;

-- Medições de obra
CREATE TABLE public.obra_medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','reprovado')),
  valor_medido NUMERIC(15,2) DEFAULT 0,
  percentual_avanco NUMERIC(5,2) DEFAULT 0,
  observacoes TEXT,
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_medicoes ENABLE ROW LEVEL SECURITY;

-- Itens de medição
CREATE TABLE public.obra_medicao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id UUID NOT NULL REFERENCES public.obra_medicoes(id) ON DELETE CASCADE,
  budget_item_id UUID REFERENCES public.obra_budget_items(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity_planned NUMERIC(15,4) DEFAULT 0,
  quantity_previous NUMERIC(15,4) DEFAULT 0,
  quantity_current NUMERIC(15,4) DEFAULT 0,
  unit_price NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_medicao_itens ENABLE ROW LEVEL SECURITY;

-- Ordens de compra
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  order_number TEXT,
  supplier TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','cotacao','aprovado','pedido','recebido','cancelado')),
  requested_by TEXT,
  requested_at DATE DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  total_value NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Itens da ordem de compra
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.product_library(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit TEXT DEFAULT 'un',
  quantity NUMERIC(15,4) DEFAULT 0,
  unit_price NUMERIC(15,2) DEFAULT 0,
  total_price NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- ── GESTÃO DO NEGÓCIO ──

-- CRM — Gestão de vendas
CREATE TABLE public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_company TEXT,
  source TEXT,
  stage TEXT NOT NULL DEFAULT 'contato' CHECK (stage IN ('contato','qualificacao','orcamentacao','proposta','negociacao','ganho','perdido')),
  estimated_value NUMERIC(15,2) DEFAULT 0,
  probability_percent INTEGER DEFAULT 50 CHECK (probability_percent >= 0 AND probability_percent <= 100),
  notes TEXT,
  lost_reason TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  assigned_to TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- Atividades do CRM (histórico de interações)
CREATE TABLE public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ligacao','email','reuniao','visita','proposta','outro')),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- Portal do cliente — acessos e compartilhamentos
CREATE TABLE public.client_portal_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_name TEXT,
  client_email TEXT,
  permissions JSONB DEFAULT '{"cronograma": true, "fotos": true, "financeiro": false, "documentos": true}',
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_portal_shares ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER update_project_phases_updated_at BEFORE UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_library_updated_at BEFORE UPDATE ON public.product_library FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_templates_updated_at BEFORE UPDATE ON public.project_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_obra_budget_items_updated_at BEFORE UPDATE ON public.obra_budget_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_obra_medicoes_updated_at BEFORE UPDATE ON public.obra_medicoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- project_phases
CREATE POLICY "Members can view project_phases" ON public.project_phases FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert project_phases" ON public.project_phases FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update project_phases" ON public.project_phases FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete project_phases" ON public.project_phases FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- project_tasks
CREATE POLICY "Members can view project_tasks" ON public.project_tasks FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert project_tasks" ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update project_tasks" ON public.project_tasks FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete project_tasks" ON public.project_tasks FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- product_library
CREATE POLICY "Members can view product_library" ON public.product_library FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert product_library" ON public.product_library FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update product_library" ON public.product_library FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete product_library" ON public.product_library FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- project_templates
CREATE POLICY "Members can view project_templates" ON public.project_templates FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert project_templates" ON public.project_templates FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update project_templates" ON public.project_templates FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete project_templates" ON public.project_templates FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- project_files
CREATE POLICY "Members can view project_files" ON public.project_files FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert project_files" ON public.project_files FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can delete project_files" ON public.project_files FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- obra_budget_items
CREATE POLICY "Members can view obra_budget_items" ON public.obra_budget_items FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert obra_budget_items" ON public.obra_budget_items FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update obra_budget_items" ON public.obra_budget_items FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete obra_budget_items" ON public.obra_budget_items FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- obra_medicoes
CREATE POLICY "Members can view obra_medicoes" ON public.obra_medicoes FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert obra_medicoes" ON public.obra_medicoes FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update obra_medicoes" ON public.obra_medicoes FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete obra_medicoes" ON public.obra_medicoes FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- obra_medicao_itens (via medicao join — use company via medicoes)
CREATE POLICY "Members can manage obra_medicao_itens" ON public.obra_medicao_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obra_medicoes m WHERE m.id = medicao_id AND public.is_company_member(m.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obra_medicoes m WHERE m.id = medicao_id AND public.is_company_member(m.company_id)));

-- purchase_orders
CREATE POLICY "Members can view purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert purchase_orders" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update purchase_orders" ON public.purchase_orders FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete purchase_orders" ON public.purchase_orders FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- purchase_order_items (via purchase_order join)
CREATE POLICY "Members can manage purchase_order_items" ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.is_company_member(po.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.is_company_member(po.company_id)));

-- crm_leads
CREATE POLICY "Members can view crm_leads" ON public.crm_leads FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert crm_leads" ON public.crm_leads FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update crm_leads" ON public.crm_leads FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete crm_leads" ON public.crm_leads FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- crm_activities
CREATE POLICY "Members can view crm_activities" ON public.crm_activities FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert crm_activities" ON public.crm_activities FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can delete crm_activities" ON public.crm_activities FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- client_portal_shares
CREATE POLICY "Members can view client_portal_shares" ON public.client_portal_shares FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert client_portal_shares" ON public.client_portal_shares FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins can update client_portal_shares" ON public.client_portal_shares FOR UPDATE TO authenticated USING (public.is_admin_in_company(company_id));
CREATE POLICY "Admins can delete client_portal_shares" ON public.client_portal_shares FOR DELETE TO authenticated USING (public.is_admin_in_company(company_id));

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
CREATE INDEX idx_project_phases_project_id ON public.project_phases(project_id);
CREATE INDEX idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_phase_id ON public.project_tasks(phase_id);
CREATE INDEX idx_obra_budget_items_project_id ON public.obra_budget_items(project_id);
CREATE INDEX idx_obra_medicoes_project_id ON public.obra_medicoes(project_id);
CREATE INDEX idx_purchase_orders_company_id ON public.purchase_orders(company_id);
CREATE INDEX idx_crm_leads_company_id ON public.crm_leads(company_id);
CREATE INDEX idx_crm_leads_stage ON public.crm_leads(stage);
CREATE INDEX idx_client_portal_shares_token ON public.client_portal_shares(access_token);
