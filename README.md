# GLITCH ROUTER V4 — GASLESS HOLDERS

**HOLD DEAD PIXELS. SWAP GASLESS.**

This build keeps V3 routing:

- LI.FI
- Direct Uniswap V3
- all routable Robinhood Chain ERC-20s / custom contract input
- 0 bps DEAD PIXELS protocol fee

and adds a holder-gated Alchemy Gas Manager execution path.

## What changed

A connected wallet holding at least **1 DEAD PIXEL** is marked gasless-eligible.

DEAD PIXELS NFT:
`0x27390fe7ae676fbfdb632e61cd4019996b07892c`

Gasless execution uses **EIP-7702** so the user's existing EOA address remains the account address. Their current token/NFT balances do not have to be moved into a separate smart-account address.

For ERC-20 swaps, the app can batch:

1. exact ERC-20 approval (only when current allowance is insufficient)
2. swap

into one sponsored Wallet API call.

If gasless execution is unavailable or the user's wallet cannot sign the required authorization, the UI does **not** silently fall back to a gas-paid transaction. The user must switch `GASLESS OFF` before using the normal V3 flow.

## Required Vercel environment variables

```text
ALCHEMY_API_KEY=
ALCHEMY_GAS_POLICY_ID=
GLITCH_GASLESS_SIGNING_SECRET=
```

Optional:

```text
LIFI_API_KEY=
RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com/
```

Never place `GLITCH_GASLESS_SIGNING_SECRET` in frontend code.

## Generate GLITCH_GASLESS_SIGNING_SECRET on Windows PowerShell

```powershell
$b=New-Object byte[] 32;$r=[Security.Cryptography.RandomNumberGenerator]::Create();$r.GetBytes($b);[BitConverter]::ToString($b).Replace('-','');$r.Dispose()
```

Put the result directly in Vercel. Do not post it publicly.

## Alchemy setup

Create an Alchemy app with **Robinhood Chain mainnet** enabled, then create a Gas Sponsorship policy for that app.

Configure the policy Custom Rules webhook as:

```text
https://portal.deadpixelslabs.com/api/paymaster-webhook
```

Set:

```text
approveOnFailure = false
```

Strongly recommended policy limits for the first live beta:

```text
Max sponsored transactions per sender: 5
Per-transaction sponsorship cap: keep very small
Global policy spend cap: set a hard daily / campaign budget
```

Start stricter and raise limits after observing real usage.

Mainnet gas sponsorship can require an Alchemy PAYG/Enterprise billing setup. The user pays $0 gas, but the sponsorship cost is paid by the Gas Manager policy owner.

## Security model in this beta

The portal backend issues a short-lived signed gasless ticket only when:

- the wallet holds >= 1 DEAD PIXEL
- the swap uses LI.FI or the official direct Uniswap router
- call shape is swap-only, or exact ERC-20 approve + swap
- approval spender is a known execution router

The Alchemy custom-rule webhook verifies:

- chain ID = 4663
- correct Gas Manager policy
- ticket HMAC
- ticket expiration
- UserOperation sender = holder wallet
- current NFT balance >= 1
- intended route target and exact swap payload are embedded in UserOperation calldata

Alchemy dashboard spend/transaction caps are still mandatory defense-in-depth.

## API checks after deployment

```text
/api/health
/api/holder?wallet=0x...
```

Expected `/api/health` after env setup:

```json
{
  "ok": true,
  "gasless": {
    "configured": true,
    "missing": []
  }
}
```

## Wallet compatibility

The gasless path depends on EIP-7702 authorization support from the connected wallet. OKX Wallet has publicly announced EIP-7702 support. If a wallet/provider rejects the authorization flow, use the normal V3 gas-paid mode instead.

## Test procedure

1. Deploy to a Vercel preview first.
2. Add the three required environment variables.
3. Confirm `/api/health` shows gasless configured.
4. Create/update the Alchemy Gas Manager policy and custom-rule webhook.
5. Connect a wallet holding DEAD PIXELS.
6. Confirm the page says `GAS SPONSORED`.
7. Test a tiny swap.
8. Check the wallet shows a sponsored / smart-account authorization flow.
9. Confirm the resulting transaction on Robinhood Chain explorer.
10. Only then promote the build to `portal.deadpixelslabs.com`.

No private key, seed phrase, or bot secret is ever required by the portal.
