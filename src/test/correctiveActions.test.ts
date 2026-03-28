import { describe, it, expect } from 'vitest';
import { generateCorrectiveActions } from '../lib/correctiveActionsEngine';

describe('generateCorrectiveActions', () => {
  it('retorna array vazio quando projection é null', () => {
    const result = generateCorrectiveActions(null, [], []);
    expect(result).toHaveLength(0);
  });

  it('retorna array vazio quando não há fases', () => {
    const projection = {
      phases: [],
      custoRealTotal: 0,
      custoPlanejadoTotal: 0,
      custoProjetadoTotal: 0,
      desvioGlobal: 0,
      riscoGlobal: 'baixo' as const,
      trendData: [],
    };
    const result = generateCorrectiveActions(projection, [], []);
    expect(result).toHaveLength(0);
  });
});
