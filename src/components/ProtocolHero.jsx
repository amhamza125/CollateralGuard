function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card card-hover p-5">
      <p className="stat-label">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${accent || "text-white"}`}>{value}</p>
      {sub && <p className="mono mt-1.5 text-slate-500">{sub}</p>}
    </div>
  );
}

export default function ProtocolHero({ protocol, accountCount, loading, isOwner }) {
  if (loading && !protocol) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 animate-pulse bg-panel" />
        ))}
      </div>
    );
  }
  if (!protocol) return null;

  const paused = protocol.paused === true || protocol.paused === "true";
  const threshold = protocol.threshold ?? "—";
  const totalChecks = protocol.total_checks ?? "0";

  return (
    <section className="animate-enter">
      {paused && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3.5">
          <svg className="h-5 w-5 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
          <p className="text-sm font-semibold text-red-300">
            Protocol is PAUSED — all checks are halted until the owner resumes.
          </p>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5">
        <p className="text-sm text-slate-300">
          <span className="font-bold text-white">Monitoring only.</span>{" "}
          Positions are user-declared simulations — amounts are not verified against any
          lending protocol, and CollateralGuard never holds, freezes, or controls real
          funds. A "locked" position is an on-chain risk flag on the record, nothing
          more. Checks are <span className="font-semibold text-white">manual</span>:
          nothing is monitored continuously — a check runs only when someone submits one.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Network status"
          value={paused ? "PAUSED" : "LIVE"}
          sub="StudioNet · chain 61999"
          accent={paused ? "text-red-400" : "text-brand"}
        />
        <StatCard
          label="Liquidation threshold"
          value={`${threshold}%`}
          sub="owner-configurable"
        />
        <StatCard
          label="Monitored positions"
          value={String(accountCount)}
          sub="on-chain registry"
        />
        <StatCard
          label="Total checks run"
          value={String(totalChecks)}
          sub="all manually triggered"
        />
      </div>
    </section>
  );
}
