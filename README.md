# DEAD PIXELS // GLITCH ROUTER V4 — GAS OPTIMIZED

No Paymaster. No gas sponsorship. User pays the actual network gas.

The goal of V4 is different:

**choose the route that leaves the user with the most value AFTER estimated gas.**

## Providers

- LI.FI
- Direct Uniswap V3
- 0 bps DEAD PIXELS protocol fee

## Gas optimizations

### 1. Best Net Output
When live USD pricing is available, routes are ranked by:

```text
gross token value
- estimated network gas
- provider fee (when reported)
= estimated net value
```

This means a route with slightly lower token output can beat a more expensive route if it uses materially less gas.

### 2. Direct vs two-hop Uniswap
The direct Uniswap scanner still checks:

- token A → token B
- token A → WETH → token B
- token A → USDG → token B

But V4 no longer automatically picks the route with the highest raw token output.

It evaluates the Quoter gas estimate for each candidate and selects the best estimated net result when token pricing is available.

### 3. Approval gas included
For ERC-20 sells, V4 checks current allowance.

If a new approval is required, its estimated gas is added to route cost before ranking.

### 4. High Gas Impact warning
The UI compares estimated gas cost against the approximate USD size of the input trade.

- >= 5%: warning
- >= 20%: high gas impact warning

The swap is not silently blocked; the user can decide.

### 5. No Paymaster
There are no Alchemy Gas Manager dependencies or sponsorship bills in this build.

## Environment

Optional:

```text
LIFI_API_KEY=
RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com/
```

For production, a dedicated RPC is recommended because gas-aware direct Uniswap scanning performs multiple `eth_call` / gas-estimation requests.

## Important caveat

Gas values are estimates. Final wallet/network cost can change between quote and inclusion.

When reliable token USD prices are unavailable, V4 falls back to:

1. highest expected token output
2. lower estimated gas as a tie-breaker

## Test

Deploy to Vercel preview first.

Check:

```text
/api/health
```

Then compare a tiny trade and a normal-sized trade. A tiny trade should show a HIGH GAS IMPACT warning when network cost is disproportionately large.
