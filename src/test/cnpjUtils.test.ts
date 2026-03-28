import { describe, it, expect } from 'vitest';
import { validateCnpj, maskCnpj } from '../lib/cnpjUtils';

describe('validateCnpj', () => {
  it('valida CNPJ correto', () => {
    expect(validateCnpj('11.222.333/0001-81')).toBe(true);
  });
  it('rejeita CNPJ com todos dígitos iguais', () => {
    expect(validateCnpj('11.111.111/1111-11')).toBe(false);
  });
  it('rejeita CNPJ com comprimento errado', () => {
    expect(validateCnpj('123')).toBe(false);
  });
});

describe('maskCnpj', () => {
  it('aplica máscara corretamente', () => {
    expect(maskCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('funciona com entrada já mascarada', () => {
    expect(maskCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
  });
});
