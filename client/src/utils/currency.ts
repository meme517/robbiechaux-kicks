/**
 * Currency helpers. All arithmetic, sorting and filtering use raw numeric RWF
 * values; formatting happens only at render time with Intl.
 */

let rwfFormatter: Intl.NumberFormat | null = null;

function buildFormatter(): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      maximumFractionDigits: 0,
    });
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'RWF',
      currencyDisplay: 'code',
      maximumFractionDigits: 0,
    });
  }
}

export function formatRWF(amount: number | null | undefined): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 'Price on request';
  if (!rwfFormatter) rwfFormatter = buildFormatter();
  return rwfFormatter.format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

/** Plain "RWF 45,000" text for WhatsApp message bodies. */
export function formatPlainRWF(amount: number): string {
  if (!Number.isFinite(amount)) return 'price on request';
  return `RWF ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`;
}
