import fetch from 'node-fetch';

async function test() {
  const token = ""; // Normally need auth, but let's test a simple mock payload without token for validation error
  
  // Actually, Joi validation usually runs FIRST before business logic, sometimes BEFORE auth if defined differently? No, auth is first.
  // We can just log into a test user or see if 401 Unauthorized is returned instead of 400 Validation Error.
  // If we get 401, validation passed or happened after auth. If we get 400 'date is not allowed', validation happened!
  
  const urls = [
    '/v1/dashboard/summary?period=MONTH&date=2026-03-25T09:16:45.851Z',
    '/v2/zentra/mental-battery?date=2026-03-25T09:16:45.851Z',
    '/v2/zentra/plan-control?date=2026-03-25T09:16:45.851Z',
    '/v2/zentra/behavior-heatmap?date=2026-03-25T09:16:45.851Z',
    '/v2/zentra/psychological-radar?date=2026-03-25T09:16:45.851Z',
    '/v2/zentra/breathwork-suggestion?date=2026-03-25T09:16:45.851Z',
    '/v2/zentra/performance-window?date=2026-03-25T09:16:45.851Z',
    '/v2/zentra/consistency-trend?days=7&date=2026-03-25T09:16:45.851Z',
    '/v2/zentra/daily-quote?date=2026-03-25T09:16:45.851Z',
    '/v1/analysis/state?date=2026-03-25T09:16:45.851Z', // Was this called with date?
  ];

  for(const url of urls) {
    try {
      const res = await fetch(`http://localhost:5000${url}`);
      const text = await res.text();
      console.log(`${url.split('?')[0]} => ${res.status}: ${text}`);
    } catch (e) {
      console.log(url, e.message);
    }
  }
}
test();
