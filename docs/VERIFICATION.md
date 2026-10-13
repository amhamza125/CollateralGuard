# CollateralGuard v3.1 — Verification record (for stewards)

This file answers the three verification requests on the resubmission, with
pointers to the evidence that can be checked independently.

**Summary**
1. The adversarial test suite is in this repo: [`tests/adversarial/`](tests/adversarial/) — runnable code, not a description.
2. The StudioNet finalization record is below (section 3) and in the raw results at [`tests/results/`](tests/results/) — every write reached GenVM finalization.
3. The deployed contract addresses are documented here (section 1) and at the top of the [README](README.md).

---

## 1. Deployed contracts (GenLayer StudioNet, chain `61999`)

| Deployment | Address | Explorer |
|---|---|---|
| **Production** (project owner's wallet `0x25cD71d3edd0d2E2F728917438991434C1c86CcD`) | `0xA32bcdDAaaBD455f92296f39A24612F52bA4323b` | https://explorer-studio.genlayer.com/address/0xA32bcdDAaaBD455f92296f39A24612F52bA4323b |
| Test (adversarial suite, my test wallet) | `0x63E6Cc23b578e11fFCBC31ba44689825034B5895` | https://explorer-studio.genlayer.com/address/0x63E6Cc23b578e11fFCBC31ba44689825034B5895 |

The contract source is [`CollateralGuard.py`](CollateralGuard.py) at the repo root —
the exact v3.1 file (the test-run copy carries an additional documentation comment
block after the imports; contract logic is identical in both, and both keep the
`# { "Depends": ... }` line immediately followed by the imports, which is the
deploy-safety requirement on GenLayer).

---

## 2. Adversarial test suite — in this repo

Location: [`tests/adversarial/`](tests/adversarial/)

- [`run.mjs`](tests/adversarial/run.mjs) — the 16-scenario adversarial suite. Run it yourself:
  ```bash
  npm install genlayer-js viem
  CG_KEY_A=<owner-key> CG_KEY_B=<second-wallet-key> CG_KEY_C=<stranger-key> node run.mjs <contract-address>
  ```
  (StudioNet is gasless; fund the three test accounts from the faucet in GenLayer Studio.)
- [`finalize.mjs`](tests/adversarial/finalize.mjs) — polls every submitted transaction to GenVM finalization: `node finalize.mjs`
- [`README.md`](tests/adversarial/README.md) — scenario list and what each one proves
- [`results/cg-results.json`](tests/results/cg-results.json) — the recorded run (2026-10-12): **16/16 scenarios PASS, 24 write txs, 13/13 intended-success writes**
- [`results/cg-finalize.json`](tests/results/cg-finalize.json) — finalization record: **24/24 transactions FINALIZED** (status `7`)

The suite was executed live on StudioNet against the test deployment above. It covers:
sender-bound registration (no account parameter), duplicate/invalid-input rejection,
safe and critical assessments with 5-feed price corroboration, locked-position
re-check rejection, stranger resume rejection, resume returning UNVERIFIED,
re-check after resume re-locking CRITICAL, threshold attacks (stranger, zero,
owner), pause-gate attacks, and aggregate readback of on-chain history.

---

## 3. StudioNet finalization record

Status `7` = GenVM **FINALIZED**. To verify any hash: paste it into the search box at
https://explorer-studio.genlayer.com and confirm `status: FINALIZED` with a successful
GenVM execution result.

### 3a. Production contract note

The matrix below covers the adversarial suite (test deployment). The production
contract (`0xA32b…323b`, section 1) additionally shows its own finalized flows on its
[explorer page](https://explorer-studio.genlayer.com/address/0xA32bcdDAaaBD455f92296f39A24612F52bA4323b):
deploy, `add_position`, `check_and_protect` → CRITICAL/lock, `resume_position` →
UNVERIFIED, and a fresh `check_and_protect` → CRITICAL again — all FINALIZED.

### 3b. Adversarial suite — full transaction matrix (test deployment)

Every one of the 24 write transactions below is FINALIZED on StudioNet. Every hash in the table links straight to its transaction on the explorer — one
click to verify. Full hashes are also in [`tests/results/cg-results.json`](tests/results/cg-results.json)
and [`tests/results/cg-finalize.json`](tests/results/cg-finalize.json).

| Tx | Step | GenVM execution | Finalization |
|---|---|---|---|
| [0x3d8f4fef…75a24](https://explorer-studio.genlayer.com/tx/0x3d8f4fef88b8aa572887ccae057a553ccdc9d49c0e5515620cb6b60857375a24) | add_position (safe-1) | SUCCESS | FINALIZED |
| [0xa64fa586…b20a8](https://explorer-studio.genlayer.com/tx/0xa64fa586c3ffc50c094a2c6d039390852defceafe9f3ad64a27690ab1edb20a8) | add_position (duplicate) | rejected | FINALIZED |
| [0x2ef9ad3a…59f60](https://explorer-studio.genlayer.com/tx/0x2ef9ad3a3a89785cad2d54aea54bf391afb78426afc34214636c507c10859f60) | add_position (DOGE collateral) | rejected | FINALIZED |
| [0x869df32e…be3ec](https://explorer-studio.genlayer.com/tx/0x869df32e35370064d130894a3cd914e2dc85fd8187ccd8b14b9dc67261abe3ec) | add_position (EUR debt) | rejected | FINALIZED |
| [0x77ee43d2…e274d](https://explorer-studio.genlayer.com/tx/0x77ee43d2a9f1017b5966c1c92d7a11be1ee85c178ffada83a8a6b8e40d8e274d) | add_position (zero amount) | rejected | FINALIZED |
| [0x7c975c53…454e3](https://explorer-studio.genlayer.com/tx/0x7c975c53f7bff7b6fc20e20e0490855a5becb352296cb6a443d8d4e8fb2454e3) | check_and_protect → SAFE 83,501%, 3 sources | SUCCESS | FINALIZED |
| [0x070c6916…2b9cf](https://explorer-studio.genlayer.com/tx/0x070c69163b7412560a56c39dfe68999a294c7c8e0e405bf9a83d0509eca2b9cf) | add_position (critical-1) | SUCCESS | FINALIZED |
| [0x0b9f2d46…60d77](https://explorer-studio.genlayer.com/tx/0x0b9f2d46a06eb32ec078d35dc313ad1044981f524f6bc18fcec3aec22aa60d77) | check_and_protect → CRITICAL 1%, locked | SUCCESS | FINALIZED |
| [0x0f2621d7…466a0](https://explorer-studio.genlayer.com/tx/0x0f2621d7ea6d1d726fbf49da725a187dce017fb08e8db409490c3a9c551466a0) | check_and_protect (locked) | rejected | FINALIZED |
| [0x35da93d9…fc258](https://explorer-studio.genlayer.com/tx/0x35da93d900c7dcc8f68dbeef4a1a2c72b89856a58739d695d406ca0c380fc258) | resume_position (stranger) | rejected | FINALIZED |
| [0x2978f9a1…c1c5a](https://explorer-studio.genlayer.com/tx/0x2978f9a1a773c9416ded1f82667a3fb9b3760564d3b491a5fdaab172427c1c5a) | resume_position (account) → UNVERIFIED | SUCCESS | FINALIZED |
| [0x051a5e55…eca74](https://explorer-studio.genlayer.com/tx/0x051a5e55eaa733780e93c623baef99236a6abe5eea6d04b2b7465a44900eca74) | resume_position (not locked) | rejected | FINALIZED |
| [0xd9916454…5f9db](https://explorer-studio.genlayer.com/tx/0xd9916454f8ffcad339600f1263ca34fb59f6b285baea08466e025e77beb5f9db) | check_and_protect → CRITICAL again | SUCCESS | FINALIZED |
| [0xebf0c974…fbde4](https://explorer-studio.genlayer.com/tx/0xebf0c9749d0a7f1b301d466923c48c5afd6e2ccdc1953ae4d78bf171654fbde4) | add_position (B's b-pos) | SUCCESS | FINALIZED |
| [0xf8761461…aec14](https://explorer-studio.genlayer.com/tx/0xf87614619bab93427b5d24682c114860b60f4afbe6f29334f3b29e18cfdaec14) | check_and_protect → SAFE 635%, 3 sources | SUCCESS | FINALIZED |
| [0x5f9a223b…3c694](https://explorer-studio.genlayer.com/tx/0x5f9a223bbfbebeedcf3646b3a3253c3700febd59fbc0f0f9d99b2d8fd223c694) | set_threshold (stranger) | rejected | FINALIZED |
| [0x4ca9dde3…6f211](https://explorer-studio.genlayer.com/tx/0x4ca9dde32607eab24516ea0651ca23acb9577d5c66a42d4a7cdc25e75ca6f211) | set_threshold (zero) | rejected | FINALIZED |
| [0x5c728f6d…999ec](https://explorer-studio.genlayer.com/tx/0x5c728f6d6987e6bce83f7df03d9db09e40997772cc12104f46235adef26999ec) | set_threshold (owner → 200) | SUCCESS | FINALIZED |
| [0x13c5ed54…a40a4](https://explorer-studio.genlayer.com/tx/0x13c5ed54027dbae16fc7103f3291138917083b4d20a1158f18af465a501a40a4) | set_threshold (owner → 150) | SUCCESS | FINALIZED |
| [0xd02aba61…a5316](https://explorer-studio.genlayer.com/tx/0xd02aba6111a280088724090a39261760bfc6fd9c87ef97c3546c4b18853a5316) | pause_protocol (stranger) | rejected | FINALIZED |
| [0x3cdcb0f8…1f3f1](https://explorer-studio.genlayer.com/tx/0x3cdcb0f8adc5b76c22bd483b8d3727c94367e0356ba0f42eb399c8043da1f3f1) | pause_protocol (owner) | SUCCESS | FINALIZED |
| [0xa4df14f1…a507e](https://explorer-studio.genlayer.com/tx/0xa4df14f144de799677c2fb759cd93dcb38ecc2d1dd2a73e34884cb5e5b4a507e) | check_and_protect (paused) | rejected | FINALIZED |
| [0x1930203f…55da3](https://explorer-studio.genlayer.com/tx/0x1930203f14d09c6a1fd8fc21ab174c8ed23a2bc7f4fddaf5684270a149955da3) | resume_protocol (owner) | SUCCESS | FINALIZED |
| [0xdc171f37…b2e97](https://explorer-studio.genlayer.com/tx/0xdc171f37f8f3908febb88f9708615829a80829a708c15454c87667b9a08b2e97) | check_and_protect (after resume) | SUCCESS | FINALIZED |

**24/24 FINALIZED · 13/13 intended-success writes finalized successfully.**

---

## 4. How to independently verify

1. Open the production address on the explorer (link in section 1) — the transaction list shows all five lifecycle transactions as FINALIZED.
2. Click any transaction hash in section 3b — confirm `status: FINALIZED` on the explorer.
3. Read the contract directly (no wallet needed): call `get_protocol_state` on the production address — it returns `contract_version: v3.1`, `enforcement: MONITORING_ONLY…`, `monitoring_mode: MANUAL…`, `position_origin: USER_DECLARED_SIMULATION`, `threshold: 150`.
4. Re-run the suite yourself with the scripts in `tests/adversarial/` against your own StudioNet deployment.

## 5. Honest limitations

- A live PRICE_CONFLICT (feeds diverging beyond 3%) could not be forced on demand — BTC/ETH feeds simply did not diverge during testing. The conflict path is implemented and fails closed; the related fail-closed path (feeds unavailable → `PRICE_FEED_UNAVAILABLE`, state untouched) **was** observed live in an earlier run and behaved correctly.
- A malformed sentiment response (INVALID path) cannot be produced on demand; by construction any non-conforming model output falls through to INVALID and is ignored — sentiment can never declare a position SAFE.
- Amounts remain user-declared (the simulation model, labeled as such everywhere); the contract cannot verify balances inside external lending protocols.
