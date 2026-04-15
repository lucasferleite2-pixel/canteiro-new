-- Warehouses/deposits per company or project
CREATE TABLE IF NOT EXISTS public.depositos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'almoxarifado' CHECK (tipo IN ('almoxarifado','deposito','obra','fornecedor','baixa')),
  responsavel TEXT,
  endereco TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Product catalog
CREATE TABLE IF NOT EXISTS public.produtos_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT NOT NULL DEFAULT 'un',
  categoria TEXT,
  preco_custo_medio NUMERIC(15,4) DEFAULT 0,
  estoque_minimo NUMERIC(15,4) DEFAULT 0,
  estoque_maximo NUMERIC(15,4),
  ativo BOOLEAN NOT NULL DEFAULT true,
  sinapi_insumo_id UUID REFERENCES public.sinapi_insumos(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Current stock balance per product per deposit
CREATE TABLE IF NOT EXISTS public.estoque_saldos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deposito_id UUID NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos_estoque(id) ON DELETE CASCADE,
  quantidade NUMERIC(15,4) NOT NULL DEFAULT 0,
  custo_medio NUMERIC(15,4) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(deposito_id, produto_id)
);

-- All stock movements
CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deposito_origem_id UUID REFERENCES public.depositos(id),
  deposito_destino_id UUID REFERENCES public.depositos(id),
  produto_id UUID NOT NULL REFERENCES public.produtos_estoque(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','transferencia','ajuste','inventario','retorno')),
  quantidade NUMERIC(15,4) NOT NULL,
  preco_unitario NUMERIC(15,4) DEFAULT 0,
  preco_total NUMERIC(15,4) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  motivo TEXT,
  documento_referencia TEXT,
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  rdo_dia_id UUID REFERENCES public.rdo_dia(id),
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view depositos" ON public.depositos FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage depositos" ON public.depositos FOR ALL TO authenticated USING (public.is_admin_in_company(company_id)) WITH CHECK (public.is_admin_in_company(company_id));

CREATE POLICY "Company members view produtos" ON public.produtos_estoque FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage produtos" ON public.produtos_estoque FOR ALL TO authenticated USING (public.is_admin_in_company(company_id)) WITH CHECK (public.is_admin_in_company(company_id));

CREATE POLICY "Company members view saldos" ON public.estoque_saldos FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage saldos" ON public.estoque_saldos FOR ALL TO authenticated USING (public.is_admin_in_company(company_id)) WITH CHECK (public.is_admin_in_company(company_id));

CREATE POLICY "Company members view movimentacoes" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert movimentacoes" ON public.estoque_movimentacoes FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Admins manage movimentacoes" ON public.estoque_movimentacoes FOR ALL TO authenticated USING (public.is_admin_in_company(company_id));

-- Function to update saldo after movement
CREATE OR REPLACE FUNCTION public.atualizar_saldo_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deposito_destino_id IS NOT NULL AND NEW.tipo IN ('entrada', 'transferencia', 'retorno', 'ajuste', 'inventario') THEN
    INSERT INTO public.estoque_saldos (company_id, deposito_id, produto_id, quantidade, custo_medio)
    VALUES (NEW.company_id, NEW.deposito_destino_id, NEW.produto_id, NEW.quantidade, NEW.preco_unitario)
    ON CONFLICT (deposito_id, produto_id) DO UPDATE SET
      quantidade = CASE
        WHEN NEW.tipo = 'inventario' THEN NEW.quantidade
        ELSE estoque_saldos.quantidade + NEW.quantidade
      END,
      custo_medio = CASE
        WHEN NEW.preco_unitario > 0 THEN
          (estoque_saldos.quantidade * estoque_saldos.custo_medio + NEW.quantidade * NEW.preco_unitario)
          / NULLIF(estoque_saldos.quantidade + NEW.quantidade, 0)
        ELSE estoque_saldos.custo_medio
      END,
      updated_at = now();
  END IF;

  IF NEW.deposito_origem_id IS NOT NULL AND NEW.tipo IN ('saida', 'transferencia') THEN
    UPDATE public.estoque_saldos
    SET quantidade = quantidade - NEW.quantidade,
        updated_at = now()
    WHERE deposito_id = NEW.deposito_origem_id AND produto_id = NEW.produto_id;
  END IF;

  UPDATE public.produtos_estoque
  SET preco_custo_medio = (
    SELECT AVG(custo_medio) FROM public.estoque_saldos WHERE produto_id = NEW.produto_id AND quantidade > 0
  ),
  updated_at = now()
  WHERE id = NEW.produto_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_atualizar_saldo
AFTER INSERT ON public.estoque_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.atualizar_saldo_estoque();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_estoque_mov_company ON public.estoque_movimentacoes(company_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_produto ON public.estoque_movimentacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_project ON public.estoque_movimentacoes(project_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_created ON public.estoque_movimentacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_saldos_deposito ON public.estoque_saldos(deposito_id);
CREATE INDEX IF NOT EXISTS idx_produtos_company ON public.produtos_estoque(company_id);
