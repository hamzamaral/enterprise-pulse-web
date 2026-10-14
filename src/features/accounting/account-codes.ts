/** Uniform chart main account (100–799) with optional dotted sub-account levels. */
export const ACCOUNT_CODE = /^[1-7]\d{2}(\.\d{1,4})*$/;

/** Next free direct sub-account code under `parent`, e.g. "120.03". */
export function nextChildCode(parent: string, codes: string[]): string {
  const prefix = `${parent}.`;
  const used = codes
    .filter((code) => code.startsWith(prefix) && !code.slice(prefix.length).includes('.'))
    .map((code) => Number(code.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  return `${prefix}${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0')}`;
}
