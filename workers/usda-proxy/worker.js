function withCors(response, origin = '*') {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function errorResponse(message, status = 500) {
  return json({ error: message }, status);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractNutrient(food = {}, numbers = [], names = []) {
  const normalizedNumbers = numbers.map(item => String(item).toLowerCase());
  const normalizedNames = names.map(item => String(item).toLowerCase());
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];

  for (const nutrient of nutrients) {
    const nutrientNumber = String(nutrient?.nutrientNumber || nutrient?.nutrient?.number || '').toLowerCase();
    const nutrientName = String(nutrient?.nutrientName || nutrient?.nutrient?.name || '').toLowerCase();
    const byNumber = normalizedNumbers.includes(nutrientNumber);
    const byName = normalizedNames.some(name => nutrientName.includes(name));
    if (!byNumber && !byName) continue;

    return Math.round(
      toNumber(
        nutrient?.value ??
        nutrient?.amount ??
        nutrient?.nutrientValue
      )
    );
  }

  return 0;
}

function stableId(base = '') {
  const normalized = String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'item';
}

function normalizeUsdaFood(food = {}) {
  const fdcId = String(food.fdcId || '').trim();
  const description = String(food.description || food.lowercaseDescription || '').trim();
  const barcode = String(food.gtinUpc || '').trim();
  const servingQuantity = toNumber(food.servingSize);
  const servingUnit = String(food.servingSizeUnit || '').trim();

  const calories = Math.round(
    toNumber(food.labelNutrients?.calories?.value ?? food.labelNutrients?.calories) ||
    extractNutrient(food, ['208'], ['energy'])
  );
  const protein = Math.round(
    toNumber(food.labelNutrients?.protein?.value ?? food.labelNutrients?.protein) ||
    extractNutrient(food, ['203'], ['protein'])
  );
  const carbs = Math.round(
    toNumber(food.labelNutrients?.carbohydrates?.value ?? food.labelNutrients?.carbohydrates) ||
    extractNutrient(food, ['205'], ['carbohydrate'])
  );
  const fat = Math.round(
    toNumber(food.labelNutrients?.fat?.value ?? food.labelNutrients?.fat) ||
    extractNutrient(food, ['204'], ['total lipid', 'fat'])
  );

  const servingSize = food.householdServingFullText
    ? String(food.householdServingFullText)
    : servingQuantity > 0
      ? `${servingQuantity}${servingUnit ? ` ${servingUnit}` : ''}`.trim()
      : null;

  return {
    id: `usda-${stableId(fdcId || barcode || description)}`,
    source: 'usda',
    sourceId: fdcId,
    name: description,
    brand: String(food.brandOwner || food.brandName || '').trim(),
    calories,
    protein,
    carbs,
    fat,
    servingSize,
    servingQuantity: servingQuantity > 0 ? servingQuantity : null,
    portion: servingQuantity > 0 ? '1 serving' : '100g',
    macrosPer100: servingQuantity <= 0,
    barcode: barcode || null,
    image: null,
    isVerified: true,
  };
}

function buildUsdaSearchUrl(query, type, apiKey) {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '25');
  url.searchParams.set('dataType', 'Branded');
  if (type === 'barcode') {
    url.searchParams.set('sortBy', 'dataType.keyword');
  }
  return url.toString();
}

function resolvePositiveInt(value, fallback) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function resolveClientIp(request) {
  const cfIp = String(request.headers.get('CF-Connecting-IP') || '').trim();
  if (cfIp) return cfIp;

  const forwarded = String(request.headers.get('X-Forwarded-For') || '').trim();
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown';
}

async function checkRateLimit(request, env, cache) {
  const maxRequests = resolvePositiveInt(env.RATE_LIMIT_MAX, 90);
  const windowSeconds = resolvePositiveInt(env.RATE_LIMIT_WINDOW_SECONDS, 60);
  if (maxRequests <= 0 || windowSeconds <= 0) {
    return { allowed: true };
  }

  const ip = resolveClientIp(request);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const cacheKey = new Request(`https://fullpot.usda-proxy.internal/rate-limit/${encodeURIComponent(ip)}/${bucket}`);

  let count = 0;
  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      const payload = await cached.json();
      count = resolvePositiveInt(payload?.count, 0);
    } catch (error) {
      count = 0;
    }
  }

  if (count >= maxRequests) {
    const elapsedInWindow = now % windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsedInWindow) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  const nextCount = count + 1;
  const nextPayload = json({ count: nextCount });
  nextPayload.headers.set('Cache-Control', `max-age=${windowSeconds}`);
  await cache.put(cacheKey, nextPayload);
  return { allowed: true };
}

async function fetchWithTimeout(url, timeoutMs) {
  if (typeof AbortController === 'undefined') {
    return fetch(url, { headers: { Accept: 'application/json' } });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`USDA upstream timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), origin);
    }

    if (request.method !== 'GET') {
      return withCors(errorResponse('Method not allowed', 405), origin);
    }

    const apiKey = String(env.USDA_API_KEY || '').trim();
    if (!apiKey) {
      return withCors(errorResponse('USDA_API_KEY is not configured', 500), origin);
    }

    const url = new URL(request.url);
    const query = String(url.searchParams.get('query') || '').trim();
    const type = String(url.searchParams.get('type') || 'text').toLowerCase();
    if (!query) {
      return withCors(errorResponse('Missing query', 400), origin);
    }
    if (query.length > 120) {
      return withCors(errorResponse('Query is too long', 400), origin);
    }
    if (!['text', 'barcode'].includes(type)) {
      return withCors(errorResponse('Invalid type, expected text or barcode', 400), origin);
    }

    const cache = caches.default;
    const rateLimit = await checkRateLimit(request, env, cache);
    if (!rateLimit.allowed) {
      const limited = errorResponse('Rate limit exceeded', 429);
      if (rateLimit.retryAfterSeconds) {
        limited.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
      }
      return withCors(limited, origin);
    }

    const cacheKey = new Request(request.url, request);
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withCors(cached, origin);
    }

    try {
      const upstreamTimeoutMs = resolvePositiveInt(env.USDA_TIMEOUT_MS, 9000);
      const usdaUrl = buildUsdaSearchUrl(query, type, apiKey);
      const upstream = await fetchWithTimeout(usdaUrl, upstreamTimeoutMs);
      if (!upstream.ok) {
        return withCors(errorResponse('USDA request failed', upstream.status), origin);
      }

      const data = await upstream.json();
      const foods = (Array.isArray(data?.foods) ? data.foods : [])
        .map(normalizeUsdaFood)
        .filter(item => item.name && (item.calories > 0 || item.protein > 0 || item.carbs > 0 || item.fat > 0));

      const response = json({ foods });
      response.headers.set('Cache-Control', 'public, max-age=300');

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return withCors(response, origin);
    } catch (error) {
      return withCors(errorResponse(error?.message || 'Unknown USDA proxy error', 500), origin);
    }
  },
};
