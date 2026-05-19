const CATEGORY_TRANSLATIONS: Record<string, string> = {
  name: 'Όνομα',
  animal: 'Ζώο',
  thing: 'Πράγμα',
  country: 'Χώρα',
  city: 'Πόλη',
  profession: 'Επάγγελμα',
  'όνομα': 'Όνομα',
  'ζώο': 'Ζώο',
  'πράγμα': 'Πράγμα',
  'χώρα': 'Χώρα',
  'πόλη': 'Πόλη',
  'επάγγελμα': 'Επάγγελμα',
};

/**
 * Translates category names from English/Greek to Greek display titles.
 */
export function translateCategory(category: string): string {
  if (!category) return '';
  const normalized = category.toLowerCase().trim();
  return CATEGORY_TRANSLATIONS[normalized] || category;
}
