import { describe, expect, it } from 'vitest';
import { blocksSalesCancel, daysLeft } from './einvoice-rules';

describe('blocksSalesCancel', () => {
  it('allows invoices without an e-invoice or with a failed one', () => {
    expect(blocksSalesCancel(null)).toBe(false);
    expect(blocksSalesCancel({ profile: 'TICARIFATURA', status: 'ERROR' })).toBe(false);
    expect(blocksSalesCancel({ profile: 'TICARIFATURA', status: 'REJECTED' })).toBe(false);
  });

  it('blocks envelopes in flight and delivered e-Fatura', () => {
    expect(blocksSalesCancel({ profile: 'EARSIVFATURA', status: 'QUEUED' })).toBe(true);
    expect(blocksSalesCancel({ profile: 'TEMELFATURA', status: 'SENT' })).toBe(true);
    expect(blocksSalesCancel({ profile: 'TEMELFATURA', status: 'DELIVERED' })).toBe(true);
    expect(blocksSalesCancel({ profile: 'TICARIFATURA', status: 'ACCEPTED' })).toBe(true);
  });

  it('lets delivered e-Arşiv be cancelled with the sales invoice', () => {
    expect(blocksSalesCancel({ profile: 'EARSIVFATURA', status: 'DELIVERED' })).toBe(false);
  });
});

describe('daysLeft', () => {
  it('counts whole days to the deadline', () => {
    expect(daysLeft('2026-10-22', '2026-10-14')).toBe(8);
    expect(daysLeft('2026-10-14T00:00:00.000Z', '2026-10-14')).toBe(0);
    expect(daysLeft('2026-10-12', '2026-10-14')).toBe(-2);
  });
});
