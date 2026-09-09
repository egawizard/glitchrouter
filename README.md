# DEAD PIXELS // GLITCH ROUTER V2 — ALL TOKENS

Non-custodial Robinhood Chain (chain ID 4663) swap UI for `portal.deadpixelslabs.com`.

## V2 behavior

- Loads the live Robinhood Chain token catalog from LI.FI.
- Search by token symbol, name, or contract.
- Any ERC-20 can still be pasted manually by contract address if it is missing from the catalog.
- A token appearing in the selector does **not** guarantee liquidity; execution still requires a valid route from a provider.

## Routing behavior

- No DEAD PIXELS / GLITCH smart contract is used for routing.
- User funds go from the user's wallet directly to the executable router returned by the selected provider.
- Protocol fee in this build: **0 bps**.
- LI.FI is enabled by default and does not require an API key for basic API usage.
- 0x comparison is automatically enabled when `ZEROX_API_KEY` is added in Vercel.
- ERC-20 approvals are exact-to-trade amounts and use only the approval spender returned by the provider.
- The quote is refreshed after approval and immediately before execution.
- Native ETH needs no approval.

## Vercel environment variables

Optional but recommended:

```text
ZEROX_API_KEY=...
LIFI_API_KEY=...
RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com/
```

`ZEROX_API_KEY` turns the page into a live LI.FI-vs-0x meta-comparison.
`LIFI_API_KEY` is optional; LI.FI basic API access works without authentication, but an API key can provide higher rate limits.
`RH_RPC_URL` is optional. If omitted, the official Robinhood Chain RPC above is used.

Do NOT put API keys in `index.html`. Keep them as Vercel environment variables.

## Deploy

Upload the project directory/ZIP to the Vercel project behind `portal.deadpixelslabs.com`.

After deployment, check:

- `/api/health`
- Connect wallet
- Make sure wallet is on Robinhood Chain
- Test a tiny amount first
- Verify approval spender + transaction destination in the wallet before confirming

## Pinned token shortcuts

- ETH native
- WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- USDG: `0x5fc5360d0400a0fd4f2af552add042d716f1d168`
- GLITCH: `0xaeca11ad61d76f7c2d6b1100d3ca9066fbdb8459`
- NVDA / NVIDIA Robinhood Token: `0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec`

Arbitrary ERC-20 contracts can be entered as CUSTOM TOKEN.

## Important

"0% protocol fee" means this app adds no DEAD PIXELS fee. Underlying DEX, router, LP, gas, provider, token tax, or RWA-related costs can still apply.

NVDA is a tokenized real-world asset. Availability and restrictions may depend on jurisdiction and issuer/provider rules.
