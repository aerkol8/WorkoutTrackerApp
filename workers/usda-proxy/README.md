# USDA Proxy (Cloudflare Worker)

This worker exposes a simple endpoint for the app:

- `GET /?type=text&query=chicken`
- `GET /?type=barcode&query=8690504030268`

Response shape:

```json
{
  "foods": [
    {
      "id": "usda-12345",
      "source": "usda",
      "sourceId": "12345",
      "name": "Food name",
      "brand": "Brand",
      "calories": 120,
      "protein": 10,
      "carbs": 12,
      "fat": 2,
      "servingSize": "170 g",
      "servingQuantity": 170,
      "portion": "1 serving",
      "macrosPer100": false,
      "barcode": "0123456789012",
      "image": null,
      "isVerified": true
    }
  ]
}
```

## Deploy

1. Install Wrangler

```bash
npm i -g wrangler
```

2. Login to Cloudflare

```bash
wrangler login
```

3. Create local config

```bash
cp wrangler.toml.example wrangler.toml
```

4. Set USDA API key secret

```bash
wrangler secret put USDA_API_KEY
```

5. (Optional but recommended) set anti-spam vars in `wrangler.toml`

```toml
[vars]
# Per-IP limit, default: 90 requests per 60 seconds
RATE_LIMIT_MAX = "90"
RATE_LIMIT_WINDOW_SECONDS = "60"

# Upstream USDA timeout in ms, default: 9000
USDA_TIMEOUT_MS = "9000"
```

6. Deploy

```bash
wrangler deploy
```

7. Put Worker URL into app `.env`

```env
EXPO_PUBLIC_USDA_PROXY_URL=https://<your-worker-subdomain>.workers.dev
```

The app calls this URL with `type` and `query` query params.

## Hardening Notes

- Keep `USDA_API_KEY` only as Worker secret (never in app code).
- Enable a Cloudflare WAF Rate Limiting rule in dashboard as a second layer (in addition to Worker-level rate limiting).
