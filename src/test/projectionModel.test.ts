import { describe, it, expect } from 'vitest';
import { calculateProjectionModel } from '../lib/projectionModel';

describe('calculateProjectionModel', () => {
  it('retorna objeto vazio quando não há RDOs', () => {
    const result = calculateProjectionModel([], []);
    expect(result.phases).toHaveLength(0);
    expect(result.custoRealTotal).toBe(0);
  });

  it('não lança erro com RDOs sem campo data', () => {
    const rdos = [{ fase_obra: 'Fundação', custo_dia: 1000 }] as any;
    expect(() => calculateProjectionModel(rdos, [])).not.toThrow();
  });

  it('classifica risco baixo quando desvio <= 3%', () => {
    const rdos = [{ data: '2026-01-01', fase_obra: 'Fundação', quantidade_executada: 10, custo_dia: 1000 }];
    const plan = [{ fase: 'Fundação', quantidade_planejada: 10, custo_planejado: 1000 }];
    const result = calculateProjectionModel(rdos, plan);
    expect(result.riscoGlobal).toBe('baixo');
  });

  it('classifica risco critico quando desvio > 15%', () => {
    const rdos = [{ data: '2026-01-01', fase_obra: 'Fundação', quantidade_executada: 5, custo_dia: 2000 }];
    const plan = [{ fase: 'Fundação', quantidade_planejada: 10, custo_planejado: 1000 }];
    const result = calculateProjectionModel(rdos, plan);
    expect(result.riscoGlobal).toBe('critico');
  });

  it('calcula corretamente custo real total', () => {
    const rdos = [
      { data: '2026-01-01', fase_obra: 'Fundação', quantidade_executada: 5, custo_dia: 500 },
      { data: '2026-01-02', fase_obra: 'Fundação', quantidade_executada: 5, custo_dia: 500 },
    ];
    const result = calculateProjectionModel(rdos, []);
    expect(result.custoRealTotal).toBe(1000);
  });
});
