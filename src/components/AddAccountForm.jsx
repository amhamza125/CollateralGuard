import { useState } from "react";
import { COLLATERAL_ASSETS, DEBT_ASSETS } from "../lib/config";

const initial = {
  label: "",
  collateral: "",
  debt: "",
  collateralAsset: "BTC",
  debtAsset: "USDT",
};

export default function AddAccountForm({ onAdd, busy, walletConnected, walletAddress }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const label = form.label.trim();
    if (!label) return "Position label is required (e.g. loan-1, btc-vault).";
    if (label.includes("#")) return "Position label must not contain '#'.";
    if (label.length > 64) return "Position label is too long (max 64 chars).";
    const c = Number(form.collateral);
    const d = Number(form.debt);
    if (!Number.isFinite(c) || c <= 0) return "Collateral amount must be a positive number.";
    if (!Number.isFinite(d) || d <= 0) return "Debt amount must be a positive number.";
    if (!Number.isInteger(c) || !Number.isInteger(d))
      return "Amounts must be whole integers (contract expects int).";
    return "";
  }

  async function submit(e) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    const ok = await onAdd({
      label: form.label.trim(),
      collateral: Number(form.collateral),
      debt: Number(form.debt),
      collateralAsset: form.collateralAsset,
      debtAsset: form.debtAsset,
    });
    if (ok) setForm(initial);
  }

  return (
    <section className="card animate-enter p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Register position</h2>
          <p className="mt-1 text-sm text-slate-400">
            Registers a position for <span className="text-slate-200">your own wallet</span> in
            the on-chain registry. Amounts are user-declared simulations — they are not
            verified against any lending protocol, and CollateralGuard never holds your funds.
          </p>
        </div>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          write tx
        </span>
      </div>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Position label</label>
          <input
            className="input font-mono"
            placeholder="e.g. loan-1"
            value={form.label}
            onChange={set("label")}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Account (your connected wallet)</label>
          <input
            className="input font-mono opacity-70"
            value={walletAddress || "Connect your wallet first"}
            readOnly
            disabled
            title="Positions are bound to the wallet that signs the transaction — registering for a third party is not possible."
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Bound on-chain to the signing wallet. You can't register a position for someone else.
          </p>
        </div>
        <div>
          <label className="label">Collateral amount</label>
          <input
            className="input font-mono"
            placeholder="e.g. 2"
            inputMode="numeric"
            value={form.collateral}
            onChange={set("collateral")}
          />
        </div>
        <div>
          <label className="label">Debt amount (USD)</label>
          <input
            className="input font-mono"
            placeholder="e.g. 50000"
            inputMode="numeric"
            value={form.debt}
            onChange={set("debt")}
          />
        </div>
        <div>
          <label className="label">Collateral asset</label>
          <select className="input" value={form.collateralAsset} onChange={set("collateralAsset")}>
            {COLLATERAL_ASSETS.map((a) => (
              <option key={a} value={a} className="bg-ink">
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Debt asset</label>
          <select className="input" value={form.debtAsset} onChange={set("debtAsset")}>
            {DEBT_ASSETS.map((a) => (
              <option key={a} value={a} className="bg-ink">
                {a}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="sm:col-span-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !walletConnected}
            className="btn-primary w-full sm:w-auto"
          >
            {busy ? "Submitting…" : "Register position"}
          </button>
          {!walletConnected && (
            <p className="mt-2 text-xs text-slate-500">
              Connect your wallet to submit write transactions.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
