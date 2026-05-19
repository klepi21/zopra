export function normalizeAnswer(answer: string): string {
  if (!answer) return '';
  return answer
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip Greek tonoi and other accents
    .toUpperCase()
    .replace(/[^A-ZΑ-Ω0-9\s-]/g, ''); // Keep only letters, digits, spaces, hyphens
}
