export interface EstoqueSaldo {
  quantidade: number;
  custo_medio: number;
}

export function calcularStatusEstoque(
  quantidade: number,
  estoqueMinimo: number,
  estoqueMaximo?: number | null
): 'critico' | 'baixo' | 'normal' | 'alto' {
  if (quantidade <= 0) return 'critico';
  if (quantidade <= estoqueMinimo) return 'baixo';
  if (estoqueMaximo != null && quantidade >= estoqueMaximo) return 'alto';
  return 'normal';
}

export function labelTipoMovimentacao(tipo: string): string {
  const labels: Record<string, string> = {
    entrada: 'Entrada',
    saida: 'Saída',
    transferencia: 'Transferência',
    ajuste: 'Ajuste',
    inventario: 'Inventário',
    retorno: 'Retorno',
  };
  return labels[tipo] ?? tipo;
}

export function calcularValorTotalEstoque(saldos: EstoqueSaldo[]): number {
  return saldos.reduce((sum, s) => sum + s.quantidade * s.custo_medio, 0);
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
