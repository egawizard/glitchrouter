
const NFT = "0x27390fe7ae676fbfdb632e61cd4019996b07892c";
const RPC =
  process.env.RH_RPC_URL ||
  "https://rpc.mainnet.chain.robinhood.com/";

function okAddress(v) {
  return /^0x[a-fA-F0-9]{40}$/.test(v || "");
}
function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function padAddress(a) {
  return a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}
async function nftBalance(wallet) {
  const data = "0x70a08231" + padAddress(wallet);
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: NFT, data }, "latest"],
    }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "RPC_ERROR");
  return BigInt(j.result || "0x0");
}
module.exports.nftBalance = nftBalance;
module.exports.NFT = NFT;

