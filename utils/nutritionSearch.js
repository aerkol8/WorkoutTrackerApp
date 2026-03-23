export function isBarcodeQuery(query = '') {
  const normalized = String(query).trim();
  return /^[0-9]{8,14}$/.test(normalized);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const USDA_PROXY_TIMEOUT_MS = 8 * 1000;

async function fetchWithTimeout(url, options = {}, timeoutMs = USDA_PROXY_TIMEOUT_MS) {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`USDA proxy timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

function scoreNameAndBrand(name = '', brand = '', query = '') {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const normalizedName = String(name || '').toLowerCase();
  const normalizedBrand = String(brand || '').toLowerCase();
  let score = 0;

  if (normalizedName === normalizedQuery) score += 120;
  if (normalizedBrand === normalizedQuery) score += 50;
  if (normalizedName.startsWith(normalizedQuery)) score += 40;
  if (normalizedBrand.startsWith(normalizedQuery)) score += 15;
  if (normalizedName.includes(normalizedQuery)) score += 18;
  if (normalizedBrand.includes(normalizedQuery)) score += 8;
  if (includesWordBoundary(normalizedName, normalizedQuery)) score += 15;

  return score;
}

export function scoreOpenFoodFactsResult(item, query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return 0;

  let score = scoreNameAndBrand(item.name, item.brand, normalizedQuery);
  if (item.barcode && item.barcode === normalizedQuery) score += 200;
  if (item.servingQuantity) score += 4;
  if (item.image) score += 4;
  if (item.calories > 0) score += 2;
  if ((item.protein || item.carbs || item.fat) > 0) score += 2;

  return score;
}

function getNutrientValue(food = {}, nutrientCandidates = []) {
  const normalizedCandidates = (nutrientCandidates || []).map(item => String(item).toLowerCase());
  const nutrients = Array.isArray(food.foodNutrients)
    ? food.foodNutrients
    : Array.isArray(food.nutrients)
      ? food.nutrients
      : [];

  for (const nutrient of nutrients) {
    const nutrientName = String(
      nutrient?.nutrientName ||
      nutrient?.name ||
      nutrient?.nutrient?.name ||
      ''
    ).toLowerCase();
    const nutrientNumber = String(
      nutrient?.nutrientNumber ||
      nutrient?.number ||
      nutrient?.nutrient?.number ||
      ''
    ).toLowerCase();
    const matches = normalizedCandidates.some(candidate => (
      nutrientNumber === candidate || nutrientName.includes(candidate)
    ));
    if (!matches) continue;

    return toNumber(
      nutrient?.value ??
      nutrient?.amount ??
      nutrient?.nutrientValue ??
      nutrient?.quantity
    );
  }

  return 0;
}

export function normalizeUsdaFood(food = {}) {
  if (!food || typeof food !== 'object') return null;

  // If proxy already returns normalized shape, sanitize and keep.
  if (food.source && (food.calories !== undefined || food.protein !== undefined || food.carbs !== undefined || food.fat !== undefined)) {
    const sourceId = String(food.sourceId || food.fdcId || food.id || food.barcode || '').trim();
    const stableIdBase = String(
      sourceId ||
      food.name ||
      food.description ||
      food.barcode ||
      'item'
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const normalizedServingQuantity = toNumber(food.servingQuantity);
    return {
      id: String(food.id || `usda-${stableIdBase || 'item'}`),
      source: 'usda',
      sourceId,
      name: String(food.name || food.description || '').trim(),
      brand: String(food.brand || food.brandOwner || '').trim(),
      calories: Math.round(toNumber(food.calories)),
      protein: Math.round(toNumber(food.protein)),
      carbs: Math.round(toNumber(food.carbs)),
      fat: Math.round(toNumber(food.fat)),
      servingSize: food.servingSize || null,
      servingQuantity: normalizedServingQuantity > 0 ? normalizedServingQuantity : null,
      portion: food.portion || (normalizedServingQuantity > 0 ? '1 serving' : '100g'),
      macrosPer100: typeof food.macrosPer100 === 'boolean' ? food.macrosPer100 : normalizedServingQuantity <= 0,
      barcode: String(food.barcode || food.gtinUpc || '').trim() || null,
      image: food.image || null,
      isVerified: food.isVerified !== false,
    };
  }

  const sourceId = String(food.fdcId || food.sourceId || food.id || '').trim();
  const calories = toNumber(
    food.labelNutrients?.calories?.value ||
    food.labelNutrients?.calories ||
    getNutrientValue(food, ['208', 'energy'])
  );
  const protein = toNumber(
    food.labelNutrients?.protein?.value ||
    food.labelNutrients?.protein ||
    getNutrientValue(food, ['203', 'protein'])
  );
  const carbs = toNumber(
    food.labelNutrients?.carbohydrates?.value ||
    food.labelNutrients?.carbohydrates ||
    getNutrientValue(food, ['205', 'carbohydrate'])
  );
  const fat = toNumber(
    food.labelNutrients?.fat?.value ||
    food.labelNutrients?.fat ||
    getNutrientValue(food, ['204', 'total lipid', 'fat'])
  );
  const servingQuantity = toNumber(food.servingSize || food.servingQuantity);
  const servingUnit = String(food.servingSizeUnit || '').trim();
  const servingSize = servingQuantity > 0
    ? `${servingQuantity}${servingUnit ? ` ${servingUnit}` : ''}`.trim()
    : null;
  const name = String(
    food.description ||
    food.name ||
    food.lowercaseDescription ||
    ''
  ).trim();
  const barcode = String(food.gtinUpc || food.barcode || '').trim() || null;

  return {
    id: `usda-${sourceId || barcode || name}`,
    source: 'usda',
    sourceId,
    name,
    brand: String(food.brandOwner || food.brandName || food.brand || '').trim(),
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    servingSize,
    servingQuantity: servingQuantity > 0 ? servingQuantity : null,
    portion: servingQuantity > 0 ? '1 serving' : '100g',
    macrosPer100: servingQuantity <= 0,
    barcode,
    image: null,
    isVerified: true,
  };
}

export function rankHybridFoodResults(items = [], query = '', { barcode = false } = {}) {
  const normalizedQuery = String(query || '').trim();
  const sourcePriority = barcode
    ? { off: 3, usda: 2, custom: 1 }
    : { usda: 3, off: 2, custom: 1 };

  return (items || [])
    .map(item => {
      const baseScore = item.source === 'off'
        ? scoreOpenFoodFactsResult(item, normalizedQuery)
        : scoreNameAndBrand(item.name, item.brand, normalizedQuery)
          + (item.barcode && item.barcode === normalizedQuery ? 200 : 0)
          + (item.isVerified ? 4 : 0)
          + (item.servingQuantity ? 3 : 0)
          + ((item.calories || item.protein || item.carbs || item.fat) ? 2 : 0);
      const sourceScore = (sourcePriority[String(item.source || '').toLowerCase()] || 0) * 25;

      return {
        ...item,
        matchScore: baseScore + sourceScore,
      };
    })
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (Boolean(b.image) !== Boolean(a.image)) return Number(Boolean(b.image)) - Number(Boolean(a.image));
      return String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' });
    });
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
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`USDA proxy request failed: ${response.status}`);
  }

  const data = await response.json();
  const foods = Array.isArray(data)
    ? data
    : Array.isArray(data?.foods)
      ? data.foods
      : [];
  return foods
    .map(normalizeUsdaFood)
    .filter(item =>
      item &&
      item.name &&
      (item.calories > 0 || item.protein > 0 || item.carbs > 0 || item.fat > 0)
    );
}
