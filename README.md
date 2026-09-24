# Sidera Dashboard

**The web frontend for the Sidera Stellar Name Service — search, resolve,
and claim `.sid` names.**

> 💠 Contribute via **Drips Wave** & **GrantFox** — see the labeled issue
> ladder and `CONTRIBUTING.md`. Fork-first; PRs against `main`.

## What it does

- **Search** any name with instant availability checks against the registry
- **Resolve** names to addresses with memo-hint metadata (`MEMO_ID` / `MEMO_TEXT` tags)
- **Claim** available names through Freighter wallet signing
- **Dashboard** listing every name owned by the connected wallet

## Live registry

The app targets the deployed testnet contract out of the box:

```ini
NEXT_PUBLIC_SIDERIA_CONTRACT_ID=CAJL7DAFAICOVMO7WXU4UUVFIAY6SODAECJPPNXPXKNUJQTNCD4GZKVQ
NEXT_PUBLIC_SIDERIA_NETWORK=testnet
```

Leave the contract ID empty to explore the UI in demo mode with mock data.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS · Lucide ·
`@stellar/freighter-api` · `@sidera-protocol/sdk`

## Run it

```bash
npm install
cp .env.example .env   # live testnet config is already filled in
npm run dev            # http://localhost:3000
```

## Suite

| Repo | Layer |
|---|---|
| [sidera-contracts](https://github.com/Sidera-Protocol/sidera-contracts) | Soroban registry (deployed on testnet) |
| [sidera-sdk](https://github.com/Sidera-Protocol/sidera-sdk) | TypeScript client |
| **sidera-app** | This dashboard |

## License

MIT
