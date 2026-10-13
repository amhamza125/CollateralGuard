const TYPE_STYLE = {
  ADD: "border-brand/40 bg-brand/10 text-brand",
  CHECK: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  RESUME_ACCOUNT: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  PAUSE_PROTOCOL: "border-red-500/40 bg-red-500/10 text-red-300",
  RESUME_PROTOCOL: "border-brand/40 bg-brand/10 text-brand",
  SET_THRESHOLD: "border-gold/40 bg-gold/10 text-gold",
};

function TypeBadge({ type }) {
  const style = TYPE_STYLE[type] || "border-white/20 bg-white/5 text-slate-300";
  return (
    <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${style}`}>
      {type || "EVENT"}
    </span>
  );
}

export default function HistoryFeed({ history }) {
  const items = Array.isArray(history) ? [...history].reverse() : [];
  return (
    <section className="card animate-enter p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Activity history</h2>
          <p className="mt-1 text-sm text-slate-400">
            On-chain event log — every add, check, and admin action.
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 font-mono text-xs text-slate-400">
          {items.length} shown
        </span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-ink px-4 py-6 text-center text-sm text-slate-500">
          No activity recorded yet.
        </p>
      ) : (
        <ol className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
          {items.map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl border border-white/5 bg-ink px-4 py-3"
            >
              <TypeBadge type={h.type} />
              <div className="min-w-0 flex-1">
                <p className="mono break-words text-slate-300">
                  {h.message || JSON.stringify(h)}
                </p>
                <p className="mono mt-1 text-slate-600">
                  {h.position_id ? `${h.position_id} · ` : ""}
                  {h.account && !h.position_id ? `${h.account.slice(0, 10)}…${h.account.slice(-6)} · ` : ""}
                  {h.seq != null ? `check #${h.seq} · ` : ""}
                  {h.ratio != null ? `ratio ${h.ratio}% · ` : ""}
                  {h.status ? `status ${h.status}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
