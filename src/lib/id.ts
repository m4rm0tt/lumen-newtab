export function uid(prefix = ''): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (const b of bytes) out += (b % 36).toString(36);
  return prefix + out;
}
