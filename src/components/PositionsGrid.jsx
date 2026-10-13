import { shortAddress, explorerAddressUrl } from "../lib/genlayer";

const STATUS_STYLE = {
  SAFE: "border-brand/40 bg-brand/10 text-brand",
  WARNING: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  CRITICAL: "border-red-500/50 bg-red-500/10 text-red-300 critical-pulse",
  UNVERIFIED: "border-slate-400/40 bg-slate-400/10 text-slate-300",
  RESUMED: "border-slate-400/40 bg-slate-400/10 text-slate-300",
};

function StatusPill({ status }) {
  const style = STATUS_STYLE[status] || "border-white/20 bg-white/5 text-slate-300";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "UNKNOWN"}
    </span>
  );
}

function RatioBar({ ratio, threshold }) {
  const r = Number(ratio) || 0;
  const t = Number(threshold) || 150;
  const max = Math.max(r, t) * 1.25 || 100;
  const fillPct = Math.min(100, (r / max) * 100);
  const tickPct = Math.min(100, (t / max) * 100);
  const breached = r < t;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={`font-display text-2xl font-bold ${breached ? "text-red-400" : "text-white"}`}>
          {r}<span className="text-sm font-semibold text-slate-500">%</span>
        </span>
        <span className="mono text-slate-500">threshold {t}%</span>
      </div>
      <div className="relative mt-2 h-2.5 overflow-visible rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${breached ? "bg-red-400" : "bg-brand"}`}
          style={{ width: `${fillPct}%` }}
        />
        <div
          className="absolute -top-1 h-4 w-0.5 bg-gold"
          style={{ left: `${tickPct}%` }}
          title={`Threshold ${t}%`}
        />
      </div>
    </div>
  );
}

function PositionCard({ record, threshold, paused, isOwner, walletAddress, walletConnected, busy, onCheck, onResume }) {
  const pid = record.position_id || "";
  const addr = record.account || "";
  const locked = record.locked === true || record.locked === "true";
  const status = record.status || "UNKNOWN";
  const isSimulation = String(record.origin || "").includes("SIMULATION");
  const unassessed = status === "UNVERIFIED";
  const canResume =
    locked &&
    walletAddress &&
    (isOwner || walletAddress.toLowerCase() === addr.toLowerCase());

  return (
    <div className="card card-hover animate-enter flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-white">
            {record.label || "Untitled position"}
          </p>
          <p className="mono mt-0.5 truncate text-slate-500" title={pid}>
            {pid}
          </p>
          {isSimulation && (
            <span className="mt-1.5 inline-block rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-400">
              USER-DECLARED SIMULATION
            </span>
          )}
        </div>
        <StatusPill status={status} />
      </div>

      <a
        href={explorerAddressUrl(addr)}
        target="_blank"
        rel="noreferrer"
        className="mono mt-2 text-brand hover:underline"
        title={addr}
      >
        {shortAddress(addr)}
      </a>

      <div className="mt-4">
        {unassessed ? (
          <div>
            <p className="font-display text-2xl font-bold text-slate-400">
              —<span className="text-sm font-semibold text-slate-500"> not assessed yet</span>
            </p>
            <p className="mono mt-1.5 text-slate-500">
              Run a manual check to get a verdict. Nothing is assumed safe.
            </p>
          </div>
        ) : (
          <RatioBar ratio={record.last_ratio} threshold={threshold} />
        )}
      </div>

      <dl className="mono mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-400">
        <dt className="text-slate-600">collateral</dt>
        <dd className="text-right text-slate-200">
          {record.collateral_amount} {record.collateral_asset}
        </dd>
        <dt className="text-slate-600">debt</dt>
        <dd className="text-right text-slate-200">
          {record.debt_amount} {record.debt_asset}
        </dd>
        <dt className="text-slate-600">ai sentiment</dt>
        <dd className="text-right text-slate-200">{record.ai_sentiment}</dd>
        <dt className="text-slate-600">price source</dt>
        <dd className="text-right text-slate-200">{record.price_source}</dd>
        <dt className="text-slate-600">last checked</dt>
        <dd className="text-right text-slate-200">{record.last_checked}</dd>
      </dl>

      {record.last_message && (
        <p className="mono mt-3 rounded-xl bg-ink px-3 py-2.5 text-slate-400">
          {record.last_message}
        </p>
      )}

      <div className="mt-4 flex gap-2 pt-1">
        <button
          onClick={() => onCheck(pid)}
          disabled={busy || paused || locked || !walletConnected}
          className="btn-primary flex-1 !py-2 text-sm"
          title={
            paused ? "Protocol paused" : locked ? "Locked — must be resumed before it can be checked again" : "Checks are manual: this submits an AI consensus check transaction"
          }
        >
          {busy ? "Checking…" : "Run manual check"}
        </button>
        {canResume && (
          <button
            onClick={() => onResume(pid)}
            disabled={busy}
            className="btn-ghost !py-2 text-sm"
            title="Clears the lock. The position returns to UNVERIFIED until a fresh check assesses it."
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}

export default function PositionsGrid({
  positions,
  threshold,
  paused,
  isOwner,
  walletConnected,
  walletAddress,
  busyPid,
  onCheck,
  onResume,
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">
          Monitored positions{" "}
          <span className="text-sm font-semibold text-slate-500">({positions.length})</span>
        </h2>
      </div>
      {positions.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <p className="font-display text-base font-semibold text-slate-300">No positions yet</p>
          <p className="max-w-md text-sm text-slate-500">
            Register your first position above — give it a label like{" "}
            <span className="font-mono text-slate-300">loan-1</span> — then run a manual
            AI consensus check to see the collateral ratio and sentiment verdict.
            Positions are user-declared simulations bound to your wallet; one wallet
            can hold many labeled positions.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {positions.map((rec) => (
            <PositionCard
              key={rec.position_id}
              record={rec}
              threshold={threshold}
              paused={paused}
              isOwner={isOwner}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              busy={busyPid === rec.position_id}
              onCheck={onCheck}
              onResume={onResume}
            />
          ))}
        </div>
      )}
    </section>
  );
}
