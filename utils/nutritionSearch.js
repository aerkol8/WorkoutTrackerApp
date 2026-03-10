export function isBarcodeQuery(query = '') {
  const normalized = String(query).trim();
  return /^[0-9]{8,14}$/.test(normalized);
}

export function dedupeFoods(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${String(item.name || '').toLowerCase()}|${String(item.brand || '').toLowerCase()}|${item.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeOpenFoodFactsProduct(product = {}) {
  const kcalFromKj = product.nutriments?.energy_100g
    ? Math.round(Number(product.nutriments.energy_100g) / 4.184)
    : 0;
  const calories = Math.round(
    product.nutriments?.['energy-kcal_100g'] ||
    product.nutriments?.['energy-kcal'] ||
    kcalFromKj ||
    0
  );

  return {
    id: `off-${product.id || product.code}`,
    source: 'off',
    sourceId: String(product.id || product.code || ''),
    name: product.product_name || product.product_name_tr || product.product_name_en || product.generic_name_tr || product.generic_name || '',
    brand: product.brands || '',
    calories,
    protein: Math.round(product.nutriments?.proteins_100g || product.nutriments?.proteins || 0),
    carbs: Math.round(product.nutriments?.carbohydrates_100g || product.nutriments?.carbohydrates || 0),
    fat: Math.round(product.nutriments?.fat_100g || product.nutriments?.fat || 0),
    servingSize: product.serving_size || null,
    servingQuantity: product.serving_quantity || null,
    barcode: product.code || null,
    image: product.image_small_url || null,
    isVerified: false,
  };
}

export async function searchOpenFoodFacts(query, { barcode = false } = {}) {
  const normalized = query.trim();
  if (!normalized) return [];

  const url = barcode
    ? `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalized)}.json`
    : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(normalized)}&search_simple=1&action=process&json=1&page_size=30&fields=id,code,product_name,product_name_tr,product_name_en,generic_name_tr,generic_name,brands,nutriments,serving_size,serving_quantity,image_small_url`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenFoodFacts request failed: ${response.status}`);
  }

  const data = await response.json();
  const products = barcode ? [data.product].filter(Boolean) : (data.products || []);

  return products
    .map(normalizeOpenFoodFactsProduct)
    .filter(item => item.name && (item.calories > 0 || item.protein > 0 || item.carbs > 0 || item.fat > 0));
}

function includesWordBoundary(text = '', query = '') {
  return String(text).toLowerCase().split(/\s+/).includes(String(query).toLowerCase());
}

export function scoreOpenFoodFactsResult(item, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const name = String(item.name || '').toLowerCase();
  const brand = String(item.brand || '').toLowerCase();
  let score = 0;

  if (!normalizedQuery) return 0;
  if (item.barcode && item.barcode === normalizedQuery) score += 200;
  if (name === normalizedQuery) score += 120;
  if (brand === normalizedQuery) score += 50;
  if (name.startsWith(normalizedQuery)) score += 40;
  if (brand.startsWith(normalizedQuery)) score += 15;
  if (name.includes(normalizedQuery)) score += 18;
  if (brand.includes(normalizedQuery)) score += 8;
  if (includesWordBoundary(name, normalizedQuery)) score += 15;
  if (item.servingQuantity) score += 4;
  if (item.image) score += 4;
  if (item.calories > 0) score += 2;
  if ((item.protein || item.carbs || item.fat) > 0) score += 2;

  return score;
}

export function rankOpenFoodFactsResults(items = [], query = '') {
  return items
    .map(item => ({ ...item, matchScore: scoreOpenFoodFactsResult(item, query) }))
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (Boolean(b.image) !== Boolean(a.image)) return Number(Boolean(b.image)) - Number(Boolean(a.image));
      return String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' });
    });
}

export async function searchUsdaProxy(query, proxyUrl, { barcode = false } = {}) {
  if (!proxyUrl) return [];

  const url = `${proxyUrl}${proxyUrl.includes('?') ? '&' : '?'}type=${barcode ? 'barcode' : 'text'}&query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`USDA proxy request failed: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.foods) ? data.foods : [];
}
