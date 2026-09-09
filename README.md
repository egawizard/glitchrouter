# DEAD PIXELS // GLITCH ROUTER V3
## LI.FI + DIRECT UNISWAP

Robinhood Chain mainnet, chain ID `4663`.

### Providers

1. **LI.FI**
2. **Direct Uniswap V3**

No 0x API is used in this build.

The direct Uniswap engine reads the official Robinhood Chain Uniswap V3 Quoter and builds a transaction directly for SwapRouter02. It searches:

- direct token A → token B pools
- 0.01%, 0.05%, 0.30%, and 1.00% V3 fee tiers
- optional two-hop routes through WETH
- optional two-hop routes through USDG

The best LI.FI quote and best direct Uniswap quote are shown side by side. The highest expected token output is selected by default.

### Official Uniswap addresses used

- V3 Quoter: `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7`
- SwapRouter02: `0xcaf681a66d020601342297493863e78c959e5cb2`
- WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`

### Environment variables

No API key is required for direct Uniswap.

Optional:

```text
LIFI_API_KEY=
RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com/
```

For production, use a dedicated Robinhood Chain RPC in `RH_RPC_URL` because the direct Uniswap route scanner performs multiple onchain quote calls.

### Security / execution

- DEAD PIXELS adds `0 bps` protocol fee.
- No DEAD PIXELS custody/router contract sits in the asset path.
- ERC-20 approval is exact-to-trade, not unlimited.
- LI.FI trades approve only the spender returned by LI.FI.
- Direct Uniswap V3 trades approve only official SwapRouter02.
- Quotes are refreshed after approval before execution.
- `amountOutMinimum` is computed from the selected slippage setting.
- Native ETH routes are wrapped/unwrapped by the official Uniswap router flow.

### V4

This build intentionally executes direct Uniswap via V3 first. LI.FI may independently choose V4 liquidity inside its own route. Direct V4 execution can be added after V3 has been tested with small live swaps; V4 uses the Universal Router/Permit2 execution model and should not be improvised into the first production build.

### Test

1. Deploy to a Vercel preview URL first.
2. Open `/api/health`.
3. Connect a Robinhood Chain wallet.
4. Test a tiny route with known liquidity.
5. Confirm the UI shows both LI.FI and UNISWAP DIRECT when both have liquidity.
6. Inspect the wallet transaction destination before confirming.
7. Only then move it to `portal.deadpixelslabs.com`.
