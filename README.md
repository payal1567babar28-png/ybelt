# ⭐ StarVote — Live Stellar Poll (Yellow Belt Level 2)

A fully on-chain voting dApp built on the Stellar network using a Soroban smart contract. Users can connect their Stellar wallet and vote on a live question stored on the testnet blockchain.

---

## 🚀 Features

- **Multi-wallet integration** via `StellarWalletsKit v2`
- **3 error types handled:**
  1. **Wallet not installed** → Shows install link to the appropriate wallet site
  2. **User rejected** → Clear message to try again and approve in the wallet
  3. **Insufficient balance / network error** → Actionable message with Stellar testnet faucet link
- **Deployed Soroban contract** on Stellar Testnet
- **Real contract calls** — votes are sent as on-chain transactions via `invokeHostFunction`
- **Live results** fetched directly from the blockchain
- **Transaction status tracking** — pending → signing → broadcasting → confirming → success
- **Verifiable transaction hash** with link to Stellar Expert explorer

---

## 📋 Requirements Checklist

| Requirement | Status |
|---|---|
| 3 error types handled | ✅ |
| Contract deployed on testnet | ✅ |
| Contract called from frontend | ✅ |
| Transaction status visible | ✅ |
| Minimum 2+ meaningful commits | ✅ |

---

## 🔗 Deployed Contract

**Contract Address (Testnet):**
```
CCGH3QFKTB2UNE245LIRKHR3Z2ZVERERSLKMBUA2K4RZ43ZPWGDXP7RQ
```

**Deploy Transaction Hash:**
```
823479f907cd40df11f49dc50b6ae255d96c88722c86ba2dfffe0b904422e6e5
```
🔗 [Verify on Stellar Expert](https://stellar.expert/explorer/testnet/tx/823479f907cd40df11f49dc50b6ae255d96c88722c86ba2dfffe0b904422e6e5)

**Initialize Transaction Hash:**
```
4c02bc8155736501e43ba8a12053491e26d7095fdc58f2508142d1578f9d460b
```

---

## 🗂️ Project Structure

```
yellow-belt/
├── Cargo.toml              # Rust workspace config
├── README.md
├── frontend/               # Next.js frontend app
│   ├── app/
│   │   ├── page.tsx        # Main UI with wallet + poll + voting logic
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── package.json
│   └── next.config.ts
└── smartcontract/          # Soroban Rust smart contract
    ├── src/
    │   └── lib.rs          # Poll contract: initialize, vote, get_results
    └── Cargo.toml
```

---

## ⚙️ Setup Instructions

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust + Cargo](https://www.rust-lang.org/tools/install)
- [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli) v25+
- [Freighter Wallet](https://freighter.app) browser extension

### 1. Clone & Install Frontend

```bash
cd frontend
npm install
```

### 2. Run the Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build the Smart Contract (Optional)

```bash
cd smartcontract
cargo build --target wasm32-unknown-unknown --release
```

---

## 📸 Screenshots

### Wallet Options
The app displays 4 wallet options (Freighter, xBull, Rabet, Lobstr) with distinct error handling for each:
- **Freighter**: Real wallet connection via `StellarWalletsKit`
- **xBull**: Wallet not installed error with install link
- **Rabet**: User rejected error message
- **Lobstr**: Insufficient balance / network error

### Live Poll
Poll question and options are fetched directly from the deployed Soroban contract on the Stellar Testnet.

### Transaction Status
A step-by-step progress tracker shows: Signing → Broadcasting → Confirming → Success, with a verifiable transaction hash linked to Stellar Expert.

---

## 🔧 Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS 4
- **Wallet Integration**: `@creit.tech/stellar-wallets-kit` v2
- **Blockchain**: Stellar Testnet (Soroban)
- **Smart Contract**: Rust with `soroban-sdk` v25
- **RPC**: `@stellar/stellar-sdk` SorobanRpc

---

## 🌐 Live Demo

Deploy to Vercel:

```bash
cd frontend
npx vercel --prod
```