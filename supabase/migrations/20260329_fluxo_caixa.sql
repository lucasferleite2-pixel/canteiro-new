-- Bank accounts
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo TEXT NOT NULL DEFAULT 'corrente' CHECK (tipo IN ('corrente','poupanca','caixa','cartao_credito','outros')),
  saldo_inicial NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_atual NUMERIC(15,2) NOT NULL DEFAULT 0,
  cor TEXT DEFAULT '#0071E3',
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Financial categories tree
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  pai_id UUID REFERENCES public.categorias_financeiras(id),
  cor TEXT DEFAULT '#6B7280',
  icone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expand financial_records with new columns
ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID REFERENCES public.contas_bancarias(id),
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.categorias_financeiras(id),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'realizado' CHECK (status IN ('previsto','realizado','cancelado')),
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE,
  ADD COLUMN IF NOT EXISTS recorrencia TEXT CHECK (recorrencia IN ('nenhuma','diaria','semanal','mensal','anual')) DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS numero_documento TEXT;

-- RLS policies
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view contas" ON public.contas_bancarias FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins can manage contas" ON public.contas_bancarias FOR ALL TO authenticated USING (public.is_admin_in_company(company_id)) WITH CHECK (public.is_admin_in_company(company_id));
CREATE POLICY "Company members can view categorias" ON public.categorias_financeiras FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins can manage categorias" ON public.categorias_financeiras FOR ALL TO authenticated USING (public.is_admin_in_company(company_id)) WITH CHECK (public.is_admin_in_company(company_id));

-- Trigger to update saldo_atual on contas_bancarias when financial_records change
CREATE OR REPLACE FUNCTION public.update_saldo_conta()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.conta_bancaria_id IS NOT NULL AND NEW.status = 'realizado' THEN
    UPDATE public.contas_bancarias SET saldo_atual = saldo_atual +
      CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END
    WHERE id = NEW.conta_bancaria_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_saldo
AFTER INSERT ON public.financial_records
FOR EACH ROW EXECUTE FUNCTION public.update_saldo_conta();
