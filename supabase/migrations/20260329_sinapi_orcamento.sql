-- SINAPI compositions table
CREATE TABLE IF NOT EXISTS public.sinapi_composicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  custo_total NUMERIC(15,4) NOT NULL DEFAULT 0,
  custo_mao_obra NUMERIC(15,4) DEFAULT 0,
  custo_material NUMERIC(15,4) DEFAULT 0,
  custo_equipamento NUMERIC(15,4) DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'NACIONAL',
  mes_referencia TEXT NOT NULL,
  ano_referencia INTEGER NOT NULL,
  tipo TEXT DEFAULT 'composicao' CHECK (tipo IN ('composicao','servico','insumo')),
  onerado BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(codigo, estado, mes_referencia, ano_referencia)
);

-- SINAPI inputs/insumos
CREATE TABLE IF NOT EXISTS public.sinapi_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  preco_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
  tipo TEXT CHECK (tipo IN ('material','mao_obra','equipamento','servico')),
  estado TEXT NOT NULL DEFAULT 'NACIONAL',
  mes_referencia TEXT NOT NULL,
  ano_referencia INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(codigo, estado, mes_referencia, ano_referencia)
);

-- Company custom compositions
CREATE TABLE IF NOT EXISTS public.composicoes_proprias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  codigo TEXT,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  custo_total NUMERIC(15,4) NOT NULL DEFAULT 0,
  notas TEXT,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Items of custom compositions
CREATE TABLE IF NOT EXISTS public.composicao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composicao_id UUID NOT NULL REFERENCES public.composicoes_proprias(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade NUMERIC(15,4) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
  preco_total NUMERIC(15,4) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  tipo TEXT CHECK (tipo IN ('material','mao_obra','equipamento','servico')) DEFAULT 'material',
  sinapi_insumo_id UUID REFERENCES public.sinapi_insumos(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Budget items with composition detail
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fase TEXT,
  codigo TEXT,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade NUMERIC(15,4) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
  preco_total NUMERIC(15,4) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  bdi NUMERIC(5,2) DEFAULT 0,
  preco_total_com_bdi NUMERIC(15,4) GENERATED ALWAYS AS (quantidade * preco_unitario * (1 + bdi/100)) STORED,
  origem TEXT CHECK (origem IN ('sinapi','composicao_propria','manual')) DEFAULT 'manual',
  sinapi_composicao_id UUID REFERENCES public.sinapi_composicoes(id),
  composicao_propria_id UUID REFERENCES public.composicoes_proprias(id),
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Budget import history
CREATE TABLE IF NOT EXISTS public.orcamento_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  total_itens INTEGER DEFAULT 0,
  valor_total NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'concluido',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.sinapi_composicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinapi_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composicoes_proprias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composicao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sinapi" ON public.sinapi_composicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read sinapi insumos" ON public.sinapi_insumos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Company members can view composicoes" ON public.composicoes_proprias FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins can manage composicoes" ON public.composicoes_proprias FOR ALL TO authenticated USING (public.is_admin_in_company(company_id)) WITH CHECK (public.is_admin_in_company(company_id));
CREATE POLICY "Company members can view composicao_itens" ON public.composicao_itens FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.composicoes_proprias cp WHERE cp.id = composicao_id AND public.is_company_member(cp.company_id)));
CREATE POLICY "Admins can manage composicao_itens" ON public.composicao_itens FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.composicoes_proprias cp WHERE cp.id = composicao_id AND public.is_admin_in_company(cp.company_id)));
CREATE POLICY "Company members can view orcamento_itens" ON public.orcamento_itens FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins can manage orcamento_itens" ON public.orcamento_itens FOR ALL TO authenticated USING (public.is_admin_in_company(company_id)) WITH CHECK (public.is_admin_in_company(company_id));
CREATE POLICY "Company members can view importacoes" ON public.orcamento_importacoes FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins can manage importacoes" ON public.orcamento_importacoes FOR ALL TO authenticated USING (public.is_admin_in_company(company_id));

CREATE INDEX IF NOT EXISTS idx_sinapi_codigo ON public.sinapi_composicoes(codigo);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_project ON public.orcamento_itens(project_id);
CREATE INDEX IF NOT EXISTS idx_composicoes_company ON public.composicoes_proprias(company_id);
