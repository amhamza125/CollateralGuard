import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  connectWallet,
  parseJson,
  readView,
  sendWrite,
  friendlyError,
  explorerTxUrl,
} from "./lib/genlayer";
import {
  DEFAULT_CONTRACT_ADDRESS,
  FAUCET_URL,
  HISTORY_PAGE_SIZE,
  STUDIO_URL,
} from "./lib/config";
import WalletBar from "./components/WalletBar";
import ProtocolHero from "./components/ProtocolHero";
import AddAccountForm from "./components/AddAccountForm";
import PositionsGrid from "./components/PositionsGrid";
import HistoryFeed from "./components/HistoryFeed";
import OwnerPanel from "./components/OwnerPanel";
import Toasts from "./components/Toasts";

let toastSeq = 0;

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [contractAddress, setContractAddress] = useState(
    () => localStorage.getItem("cg_contract") || DEFAULT_CONTRACT_ADDRESS
  );
  const [protocol, setProtocol] = useState(null);
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(null); // string key of in-flight write
  const [busyPid, setBusyPid] = useState(null);
  const [toasts, setToasts] = useState([]);
  const refreshTimer = useRef(null);

  const isOwner = useMemo(() => {
    if (!wallet || !protocol || !protocol.owner) return false;
    return wallet.toLowerCase() === String(protocol.owner).toLowerCase();
  }, [wallet, protocol]);

  const paused = protocol?.paused === true || protocol?.paused === "true";

  /* ---------------- toasts ---------------- */
  const dismissToast = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((kind, title, message = "", link = "") => {
    const id = ++toastSeq;
    setToasts((ts) => [...ts.slice(-4), { id, kind, title, message, link }]);
    return id;
  }, []);

  const updateToast = useCallback((id, kind, title, message = "", link = "") => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { id, kind, title, message, link } : t)));
  }, []);

  /* ---------------- data ---------------- */
  const refresh = useCallback(async () => {
    if (!contractAddress) return;
    setLoading(true);
    setLoadError("");
    try {
      const [pRaw, aRaw, hRaw] = await Promise.all([
        readView(contractAddress, "get_protocol_state", []),
        readView(contractAddress, "get_all_positions", []),
        readView(contractAddress, "get_check_history", [HISTORY_PAGE_SIZE]),
      ]);
      setProtocol(parseJson(pRaw));
      setPositions(parseJson(aRaw) || []);
      setHistory(parseJson(hRaw) || []);
    } catch (e) {
      setLoadError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    refresh();
    // Gentle auto-refresh so consensus results appear without manual reloads.
    refreshTimer.current = setInterval(refresh, 20000);
    return () => clearInterval(refreshTimer.current);
  }, [refresh]);

  /* ---------------- wallet ---------------- */
  async function handleConnect() {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setWallet(addr);
      pushToast("success", "Wallet connected", addr);
    } catch (e) {
      pushToast("error", "Connection failed", friendlyError(e));
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    setWallet(null);
  }

  function handleSaveContract(addr) {
    setContractAddress(addr);
    if (addr) localStorage.setItem("cg_contract", addr);
    else localStorage.removeItem("cg_contract");
    pushToast("info", addr ? "Contract address updated" : "Contract address cleared");
  }

  /* ---------------- writes ---------------- */
  async function runWrite(key, label, functionName, args, pidForBusy = null) {
    if (!wallet) {
      pushToast("error", "Wallet required", "Connect your wallet first.");
      return false;
    }
    if (!contractAddress) {
      pushToast("error", "Contract required", "Set the contract address first.");
      return false;
    }
    setBusy(key);
    if (pidForBusy) setBusyPid(pidForBusy);
    const toastId = pushToast("pending", label, "Waiting for wallet signature…");
    try {
      const { hash } = await sendWrite(wallet, contractAddress, functionName, args);
      updateToast(toastId, "pending", label, "Finalizing on GenLayer…", explorerTxUrl(hash));
      await refresh();
      updateToast(toastId, "success", label, "Finalized on-chain.", explorerTxUrl(hash));
      return true;
    } catch (e) {
      updateToast(toastId, "error", label, friendlyError(e));
      return false;
    } finally {
      setBusy(null);
      setBusyPid(null);
    }
  }

  const handleAdd = (f) => {
    const pid = `${wallet}#${f.label}`.toLowerCase();
    const exists = positions.some(
      (p) => (p.position_id || "").toLowerCase() === pid
    );
    if (exists) {
      pushToast(
        "error",
        "Already monitored",
        `Position "${f.label}" for your wallet is already registered — run a check on its card instead, or use a different label.`
      );
      return Promise.resolve(false);
    }
    // v3: positions bind to the transaction sender on-chain. There is no
    // account parameter — a wallet can only register its own positions.
    return runWrite("add", "Registering position", "add_position", [
      f.label,
      f.collateral,
      f.debt,
      f.collateralAsset,
      f.debtAsset,
    ]);
  };

  const handleCheck = (pid) =>
    runWrite(`check-${pid}`, "Running AI check", "check_and_protect", [pid], pid);

  const handleResumePosition = (pid) =>
    runWrite(`resume-${pid}`, "Resuming position", "resume_position", [pid], pid);

  const handleSetThreshold = (v) =>
    runWrite("threshold", "Updating threshold", "set_threshold", [v]);

  const handlePause = () => runWrite("pause", "Pausing protocol", "pause_protocol", []);
  const handleResumeProtocol = () =>
    runWrite("resumeProto", "Resuming protocol", "resume_protocol", []);

  /* ---------------- render ---------------- */
  return (
    <div className="min-h-screen bg-ink font-body">
      <WalletBar
        wallet={wallet}
        connecting={connecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        contractAddress={contractAddress}
        onSaveContract={handleSaveContract}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {!contractAddress ? (
          <section className="card mx-auto mt-10 max-w-xl p-8 text-center">
            <h2 className="font-display text-2xl font-bold text-white">
              Point the dashboard at your contract
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Deploy <span className="font-mono text-slate-300">collateral_guard.py</span> in{" "}
              <a href={STUDIO_URL} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                GenLayer Studio
              </a>{" "}
              (or via the CLI), then paste the contract address using the{" "}
              <span className="font-semibold text-slate-200">“Set contract”</span> button in the
              top bar — or set <span className="font-mono text-slate-200">VITE_CONTRACT_ADDRESS</span> when
              deploying to Vercel.
            </p>
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost mt-6"
            >
              Get testnet GEN from the faucet
            </a>
          </section>
        ) : (
          <>
            {loadError && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3.5 text-sm text-red-300">
                Failed to load contract state: {loadError}
              </div>
            )}

            <ProtocolHero
              protocol={protocol}
              accountCount={positions.length}
              loading={loading}
              isOwner={isOwner}
            />

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <AddAccountForm
                  onAdd={handleAdd}
                  busy={busy === "add"}
                  walletConnected={!!wallet}
                  walletAddress={wallet}
                />
              </div>
              <div className="lg:col-span-3">
                <OwnerPanel
                  isOwner={isOwner}
                  walletConnected={!!wallet}
                  paused={paused}
                  busy={!!busy}
                  onSetThreshold={handleSetThreshold}
                  onPause={handlePause}
                  onResume={handleResumeProtocol}
                />
              </div>
            </div>

            <PositionsGrid
              positions={positions}
              threshold={protocol?.threshold ?? 150}
              paused={paused}
              isOwner={isOwner}
              walletConnected={!!wallet}
              walletAddress={wallet}
              busyPid={busyPid}
              onCheck={handleCheck}
              onResume={handleResumePosition}
            />

            <HistoryFeed history={history} />

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 pb-4">
              <p className="mono text-slate-600">
                CollateralGuard dashboard · StudioNet · not financial advice
              </p>
              <div className="flex gap-4">
                <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-400 hover:text-brand">
                  Faucet
                </a>
                <a href={STUDIO_URL} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-400 hover:text-brand">
                  Studio
                </a>
              </div>
            </footer>
          </>
        )}
      </main>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
