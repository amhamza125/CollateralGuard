// Central configuration for the CollateralGuard dashboard.
// The deployed contract address can be supplied via the VITE_CONTRACT_ADDRESS
// environment variable (Vercel) or overridden in the UI (saved to localStorage).

export const STUDIO_CHAIN_ID_HEX = "0xf22f"; // 61999
export const STUDIO_CHAIN_NAME = "GenLayer StudioNet";
export const STUDIO_RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const STUDIO_URL = "https://studio.genlayer.com";
// StudioNet funds test accounts from inside Studio (faucet button), no external form needed.
export const FAUCET_URL = "https://studio.genlayer.com";
export const DOCS_URL = "https://docs.genlayer.com";

export const DEFAULT_CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "";

// Must match the patched contract's validation.
export const COLLATERAL_ASSETS = ["BTC", "ETH", "SOL"];
export const DEBT_ASSETS = ["USDT", "USDC", "DAI"];

export const HISTORY_PAGE_SIZE = 50;
