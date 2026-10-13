# Adversarial test suite — CollateralGuard v3.1

Live end-to-end tests executed on **GenLayer StudioNet (chain 61999)** against the
v3.1 contract. This suite answers the steward review point by point; every scenario
below is a real on-chain transaction, and the recorded results are in
[`../results/`](../results/).

## How to run it yourself

```bash
npm install genlayer-js viem
# fund three throwaway test accounts with the faucet in GenLayer Studio (StudioNet is gasless)
CG_KEY_A=<owner-key> CG_KEY_B=<second-wallet-key> CG_KEY_C=<stranger-key> node run.mjs <contract-address>
node finalize.mjs
```

`run.mjs` writes `./cg-results.json`; `finalize.mjs` polls every submitted transaction
to GenVM finalization and writes `../results/cg-finalize.json`. Total wall time is
roughly 20–40 minutes (AI checks take longer than plain transactions).

## The 16 scenarios (recorded run: 16/16 PASS, 24/24 txs FINALIZED)

| # | Scenario | What it proves |
|---|---|---|
| 1 | Protocol state readback | v3.1 disclosures present: version, USER_DECLARED_SIMULATION, MONITORING_ONLY, MANUAL mode |
| 2 | Register position (safe-1) | sender-bound (no account parameter), status UNVERIFIED, origin USER_DECLARED_SIMULATION |
| 3 | Duplicate registration | rejected |
| 4 | Invalid collateral asset / invalid debt asset / zero amount | all rejected |
| 5 | Check safe position (triggered by another wallet) | SAFE, ratio 83,501%, 3 price sources agreed (coinbase+coingecko+kraken), sentiment NEUTRAL |
| 6 | Register + check critical position | CRITICAL at ratio 1%, position locked |
| 7 | Re-check a locked position | rejected |
| 8 | Stranger tries to resume | rejected; position stays locked |
| 9 | Position account resumes | lock cleared, status returns to UNVERIFIED — not safe |
| 10 | Resume a non-locked position | rejected |
| 11 | Fresh check after resume | CRITICAL again — resume did not fake safety |
| 12 | Second wallet registers its own position | bound to that wallet; per-account listings strictly separated |
| 13 | Check the ETH position | SAFE, ratio 635%, 3 sources agreed — corroboration works across assets |
| 14 | Threshold attacks (stranger set, owner set 0, owner set 200) | attacks rejected; legitimate change applied and read back |
| 15 | Pause attacks + gate (stranger pause, owner pause, check while paused, resume) | only the owner can pause; checks are blocked while paused and work after |
| 16 | Aggregate readback | 3 positions, 13 history events, every CHECK carries `trigger: MANUAL` |

## Running against the production contract

The suite is baseline-relative: it also runs on a contract that already has
positions and history. To run the full battery against the production deployment:

```bash
CG_KEY_A=<owner-wallet-key> CG_KEY_B=<fresh-wallet-key> CG_KEY_C=<fresh-wallet-key> node run.mjs 0xA32bcdDAaaBD455f92296f39A24612F52bA4323b
node finalize.mjs
```

Rules for a production run:

- `CG_KEY_A` **must be the contract owner's key** (scenarios 14–15 are owner-only).
  Keys live only in your terminal's environment for the run — they are never written
  to disk or committed. Never send a private key to anyone, including me.
- Fund the two fresh wallets (B, C) from the faucet in GenLayer Studio. StudioNet is gasless.
- The suite creates **3 permanent test positions** (`safe-1`, `critical-1`, `b-pos`) —
  the contract has no delete method, so they stay on the contract. `critical-1` ends
  locked, which also demonstrates the lock feature on the live contract.
- Wall time is roughly 20–40 minutes (validator consensus on AI checks is slow).
  Keep the terminal alive until `finalize.mjs` reports 24/24 FINALIZED.

## Honest notes

- The recorded run (2026-10-12) was executed from my test setup
  against the test deployment `0x63E6Cc23b578e11fFCBC31ba44689825034B5895` — the same
  v3.1 contract file. The production deployment `0xA32bcdDAaaBD455f92296f39A24612F52bA4323b`
  (owner's wallet) has its own 5-transaction smoke cycle recorded in
  [`../../docs/VERIFICATION.md`](../../docs/VERIFICATION.md).
- A live PRICE_CONFLICT (feeds diverging beyond 3%) could not be forced on demand;
  the related fail-closed path (feeds unavailable → `PRICE_FEED_UNAVAILABLE`, state
  untouched) was observed live in an earlier run.
