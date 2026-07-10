---
name: World4You PHP deploy quirks
description: Shared-hosting quirks specific to the World4You PHP deploy target for SuiKa (cURL, timeouts, caching, auth)
---

# World4You / shared PHP hosting quirks

- **cURL required for external HTTP.** `file_get_contents()` with a URL wrapper
  can be disabled on shared hosting; always use cURL (or `curl_multi` for
  concurrent fetches) for any outbound request in PHP endpoints deployed here.
- **Fetch feeds concurrently, not sequentially.** Shared hosts commonly cap
  `max_execution_time` around 30s. Sequentially fetching N upstream feeds at
  ~12s timeout each can exceed that and fatal the whole endpoint with zero
  output. Use `curl_multi` to fetch all upstream URLs in parallel so the worst
  case is ~one timeout, not N.
- **File-based response caches must validate content before trusting mtime.**
  A pattern like "if cache file is newer than TTL, serve it as-is" will happily
  keep serving a stale/empty/broken cached response for the full TTL window if
  that file was ever written during a failure (e.g. an endpoint bug that made
  every upstream fetch fail). Always decode and sanity-check the cached payload
  (e.g. non-empty array) before trusting it, and don't write a fresh cache file
  when the freshly-fetched result is itself empty.
  **Why:** on SuiKa, an earlier bug (an endpoint that should have been public
  called `require_auth()`) made every request fail before ever populating
  useful data, but a near-empty cache file still got written and then was
  blindly re-served for 30 minutes after the auth bug was fixed, masking the
  fix.
- **Public/global-data endpoints must not call `require_auth()`.** Only
  gate endpoints that read/write per-user data behind auth; anything that
  serves the same data to every user (e.g. aggregated public feeds) should be
  reachable by guests, same as other public endpoints in this app.
