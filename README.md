# CollateralGuard Dashboard

High-end testing dashboard for the **CollateralGuard** GenLayer Intelligent Contract —
a DeFi collateral monitor with AI-sentiment consensus, multi-source price feeds, and
owner-controlled emergency stops. Built for **GenLayer StudioNet** (chain `61999`).

## What you can test from the UI

| Action | Contract method | Notes |
|---|---|---|
| Register position | `add_monitored_account` | Validates assets client-side (BTC/ETH/SOL + USDT/USDC/DAI) |
| Run AI check | `check_and_protect` | Triggers validator consensus: live price + LLM sentiment |
| Resume locked account | `resume_account` | Owner only |
| Set threshold | `set_threshold` | Owner only, 1–1000 |
| Pause / resume protocol | `pause_protocol` / `resume_protocol` | Owner only |
| View state | `get_protocol_state`, `get_all_accounts`, `get_check_history` | Walletless reads |

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

## Suggested smoke test

1. Register `2 BTC` vs `50000 USDT` debt → Run check → expect `SAFE`.
2. Register `1 BTC` vs `90000 USDT` debt → Run check → expect `CRITICAL` + locked.
3. As owner: **Resume** the locked account.
4. As owner: set threshold to `200`, re-run a check, then set it back.
5. As owner: **Pause protocol** → confirm checks are blocked → **Resume**.

## Notes

- Reads (`get_*`) need no wallet; writes prompt your wallet and wait for
  `FINALIZED` consensus (AI checks take longer than plain transactions).
- Dashboard auto-refreshes every 20s so consensus results appear by themselves.
- Testnet only — not financial advice.
