
import { createWalletClient, custom, defineChain } from "viem";
import {
  createSmartWalletClient,
  alchemyWalletTransport,
} from "@alchemy/wallet-apis";

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

let cachedConfig = null;
let cachedOwner = null;
let cachedClient = null;

async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  const r = await fetch("/api/gasless-config", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "GASLESS CONFIG ERROR");
  cachedConfig = j;
  return j;
}

async function holderStatus(wallet) {
  const r = await fetch(`/api/holder?wallet=${encodeURIComponent(wallet)}`, {
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "HOLDER CHECK FAILED");
  return j;
}

async function smartClient(owner) {
  const cfg = await loadConfig();
  if (!cfg.enabled) throw new Error("GASLESS NOT CONFIGURED");
  if (!window.ethereum) throw new Error("NO EVM WALLET DETECTED");

  if (
    cachedClient &&
    cachedOwner &&
    cachedOwner.toLowerCase() === owner.toLowerCase()
  ) {
    return { client: cachedClient, cfg };
  }

  const signer = createWalletClient({
    account: owner,
    chain: robinhood,
    transport: custom(window.ethereum),
  });

  cachedClient = createSmartWalletClient({
    signer,
    chain: robinhood,
    transport: alchemyWalletTransport({ apiKey: cfg.alchemyApiKey }),
    paymaster: { policyId: cfg.policyId },
  });
  cachedOwner = owner;
  return { client: cachedClient, cfg };
}

async function createTicket(wallet, provider, calls) {
  const r = await fetch("/api/gasless-ticket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, provider, calls }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "GASLESS TICKET DENIED");
  return j;
}

function normalizeCalls(calls) {
  return calls.map((c) => ({
    to: c.to,
    data: c.data || "0x",
    value:
      typeof c.value === "bigint"
        ? c.value
        : BigInt(c.value || "0x0"),
  }));
}

async function sendSponsored({ owner, provider, calls, onStatus }) {
  const cfg = await loadConfig();
  if (!cfg.enabled) throw new Error("GASLESS NOT CONFIGURED");

  const hs = await holderStatus(owner);
  if (!hs.eligible) throw new Error("DEAD PIXELS HOLDER REQUIRED");

  const ticket = await createTicket(owner, provider, calls);
  onStatus?.(
    `GASLESS ELIGIBLE // ${hs.balance} DEAD PIXELS // PREPARING SPONSORED SWAP`
  );

  const { client } = await smartClient(owner);

  // EIP-7702 keeps the same EOA address, so existing NFT/token balances stay
  // at the user's current address. Wallet must support authorization signing.
  const result = await client.sendCalls({
    calls: normalizeCalls(calls),
    capabilities: {
      paymaster: {
        policyId: cfg.policyId,
        webhookData: ticket.ticket,
      },
    },
  });

  onStatus?.("PAYMASTER ACCEPTED // WAITING FOR USER OPERATION CONFIRMATION");
  const status = await client.waitForCallsStatus({
    id: result.id,
    timeout: 180_000,
  });

  if (status.status !== "success") {
    throw new Error(`SPONSORED CALL ${String(status.status || "FAILED").toUpperCase()}`);
  }

  const txHash =
    status.receipts?.[0]?.transactionHash ||
    status.receipts?.[0]?.transactionHash ||
    null;

  return { id: result.id, txHash, status, holderBalance: hs.balance };
}

window.glitchGasless = {
  loadConfig,
  holderStatus,
  sendSponsored,
  reset() {
    cachedClient = null;
    cachedOwner = null;
    cachedConfig = null;
  },
};

window.dispatchEvent(new CustomEvent("glitch-gasless-ready"));
