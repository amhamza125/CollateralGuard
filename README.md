# CollateralGuard Dashboard

## Live deployments (GenLayer StudioNet, chain `61999`)

- **Production:** `0xA32bcdDAaaBD455f92296f39A24612F52bA4323b` — [explorer](https://explorer-studio.genlayer.com/address/0xA32bcdDAaaBD455f92296f39A24612F52bA4323b) · deployed from the project owner's wallet; this is the address the dashboard points to.
- **Test deployment** (used for the adversarial suite): `0x63E6Cc23b578e11fFCBC31ba44689825034B5895`.
- **Verification record:** [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — deployed addresses, the StudioNet finalization record for every transaction, and how to independently verify.
- **Adversarial test suite:** [`tests/adversarial/`](tests/adversarial/) — the runnable 16-scenario suite, with raw results in [`tests/results/`](tests/results/).

High-end testing dashboard for the **CollateralGuard** GenLayer Intelligent Contract —
a DeFi collateral **monitor** with AI-sentiment consensus, corroborated multi-source
price feeds, and owner-controlled emergency stops. Built for **GenLayer StudioNet**
(chain `61999`).

> **Scope, stated plainly:** CollateralGuard is monitoring-only. Positions are
> user-declared simulations — amounts are not verified against any lending protocol,
> and the contract never holds, freezes, or controls real funds. A "locked" position
> is an on-chain risk flag on the record. Checks are manual: a check runs only when
> someone submits one; there is no continuous monitoring.

## What you can test from the UI

| Action | Contract method (v3.1) | Notes |
|---|---|---|
| Register position | `add_position` | Bound to your wallet on-chain (`youraddress#label`) — registering for a third party is impossible; validates assets client-side |
| Run AI check | `check_and_protect` | Takes a position ID; manual trigger; validators corroborate prices across up to 5 sources (≥2 must agree within 3%) |
| Resume locked position | `resume_position` | Position account or contract owner; position returns to UNVERIFIED until re-checked |
| Set threshold | `set_threshold` | Owner only, 1–1000 |
| Pause / resume protocol | `pause_protocol` / `resume_protocol` | Owner only |
| View state | `get_protocol_state`, `get_all_positions`, `get_positions_for_account`, `get_check_history` | Walletless reads |

## Local development

```bash
npm install
cp .env.example .env   # then put your deployed contract address in .env
npm run dev
```

Open http://localhost:5173. If you skip the `.env`, you can paste the contract
address with the **Set contract** button in the top bar (saved to localStorage).

StudioNet is gasless for development — fund your test account with the faucet
button inside [GenLayer Studio](https://studio.genlayer.com).

## Deploy to Vercel via GitHub

1. **Push this folder to GitHub**
   ```bash
   cd collateral-guard-dashboard
   git init
   git add .
   git commit -m "CollateralGuard dashboard"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. **Import into Vercel**
   - Go to https://vercel.com/new and import your GitHub repo.
   - Framework preset: **Vite** (auto-detected). Build command `npm run build`,
     output directory `dist` — the defaults are correct.

3. **Set the environment variable**
   - In Vercel → Project → Settings → Environment Variables, add:
     - Key: `VITE_CONTRACT_ADDRESS`
     - Value: your deployed contract address on StudioNet (e.g. `0xabc…`)
   - Redeploy after adding it.

4. **Test the live site**
   - Connect MetaMask/Rabby (the app auto-adds StudioNet, chain `61999`, to your wallet).
   - Fund with test GEN from the faucet inside GenLayer Studio.
   - Register a position → **Run check** → watch the AI consensus verdict land.

## Suggested smoke test (v3.1 — contract already deployed at the production address above)

1. Register `2 BTC` vs `50000 USDT` debt with label `loan-1` → Run check → expect `SAFE`.
2. Register `1 BTC` vs `90000 USDT` debt with label `loan-2` **on the same address** → Run check → expect `CRITICAL` + locked. (This is the multi-position case.)
3. As owner: **Resume** the locked position.
4. As owner: set threshold to `200`, re-run a check, then set it back.
5. As owner: **Pause protocol** → confirm checks are blocked → **Resume**.

## Notes

- Reads (`get_*`) need no wallet; writes prompt your wallet and wait for
  `FINALIZED` consensus (AI checks take longer than plain transactions).
- Dashboard auto-refreshes every 20s so consensus results appear by themselves.
- Testnet only — not financial advice.
