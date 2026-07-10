---
name: Testing zombie-tab pollution
description: Repeated runTest calls in one session can accumulate open browser tabs whose independent activity mimics a render loop.
---

Calling `runTest` many times in one debugging session can leave previous
browser tabs/contexts open in the background. Those old tabs keep a live dev
server WebSocket (HMR) connection and their own query state. When the
workflow later restarts (e.g. after a code fix), every still-open zombie tab
independently reconnects and refetches at once, producing a burst of
requests and console logs that looks exactly like a single-page infinite
render loop — but isn't.

**Why:** Wasted significant debugging effort in the SuiKa app chasing a
"render loop" that was partly real (see
`react-query-shared-loading-gate.md`) and partly an artifact of accumulated
zombie tabs from earlier `runTest` calls in the same long session.

**How to apply:** When debugging a suspected render loop, reload loop, or
"stuck" UI via `runTest`, explicitly instruct the test plan to close any
other open tabs/contexts first and use exactly one isolated context, and to
close it at the end. Don't trust request/console volume from a test session
as proof of a client-side loop unless it was captured in a single, freshly
isolated tab.
