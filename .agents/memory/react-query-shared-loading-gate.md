---
name: React Query shared-observer loading gate bug
description: A top-level view gated on a shared query's isLoading can be blanked by unrelated components remounting the same query.
---

If multiple components call the same query hook (e.g. `useGetMe()` in both a
root `App`/`MainApp` and a child tab component), mounting a new observer on an
already-settled (especially already-errored) query can cause that query's
`isLoading`/`status` to transition back through a pending-like state as part
of its background refetch-on-mount.

If a parent component uses raw `isLoading` from that query to gate rendering
the entire UI (e.g. `if (isLoading) return <FullPageSpinner />`), every time a
child component mounts and re-triggers that shared query, the whole app blanks
back to the boot spinner — including nav — making the app look "stuck" or
looping when a user navigates between views, even though no actual bug exists
in the child view itself.

**Why:** Observed and reproduced in the SuiKa app: `MainApp` gated on
`useGetMe().isLoading`, and `LocalTab` also called `useGetMe()` for the user's
saved location. Clicking into the Local tab reset the shared query to a
pending-like state, causing `MainApp` to fall back to the full-page spinner
and hide all navigation — indistinguishable from an infinite loading loop.
Confirmed via isolated single-browser-tab e2e testing (multiple stacked test
sessions can leave zombie tabs whose independent reconnect/refetch traffic
looks like a render loop but isn't — always test with a single, freshly
isolated browser context when debugging suspected render loops).

**How to apply:** When a shared query's loading state gates a top-level view,
track "has this resolved at least once" (e.g. a `hasChecked` state flag set
once `isLoading` goes false) instead of relying on live `isLoading`. Only
gate on the one-time initial resolution, not on every subsequent
background refetch triggered by unrelated components mounting the same query.
