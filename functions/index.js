const { onRequest } = require('firebase-functions/v2/https');

function json(res, status, body) {
  res.status(status).set('Access-Control-Allow-Origin', '*').json(body);
}

function extractNutrient(food, names) {
  const nutrient = (food.foodNutrients || []).find(entry =>
    names.includes(entry.nutrientName) || names.includes(entry.nutrient?.name)
  );
  return Math.round(Number(nutrient?.value || nutrient?.amount || 0));
}

function normalizeUsdaFood(food = {}) {
  return {
    id: `usda-${food.fdcId}`,
    source: 'usda',
    sourceId: String(food.fdcId || ''),
    name: food.description || '',
    brand: food.brandOwner || food.brandName || '',
    calories: extractNutrient(food, ['Energy']),
    protein: extractNutrient(food, ['Protein']),
    carbs: extractNutrient(food, ['Carbohydrate, by difference']),
    fat: extractNutrient(food, ['Total lipid (fat)']),
    servingSize: food.householdServingFullText || null,
    servingQuantity: food.servingSize || null,
    barcode: food.gtinUpc || null,
    image: null,
    isVerified: true,
  };
}

exports.usdaProxy = onRequest(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  const apiKey = process.env.USDA_API_KEY;
  const query = String(req.query.query || '').trim();
  const type = String(req.query.type || 'text');

  if (!apiKey) {
    json(res, 500, { error: 'USDA_API_KEY is not configured' });
    return;
  }

  if (!query) {
    json(res, 400, { error: 'Missing query' });
    return;
  }

  try {
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('dataType', 'Branded');
    if (type === 'barcode') {
      url.searchParams.set('sortBy', 'dataType.keyword');
    }

    const response = await fetch(url);
    if (!response.ok) {
      json(res, response.status, { error: 'USDA request failed' });
      return;
    }

    const data = await response.json();
    const foods = (data.foods || []).map(normalizeUsdaFood).filter(food => food.name);
    json(res, 200, { foods });
  } catch (error) {
    json(res, 500, { error: error.message || 'Unknown USDA proxy error' });
  }
});
