<div align="center">

# ⭐ StarVote
### Live On-Chain Poll · Stellar Yellow Belt — Level 2

**A fully decentralized voting dApp built on the Stellar network.**  
Users connect their Stellar wallet and cast real on-chain votes via a deployed Soroban smart contract.

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar)](https://stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Soroban](https://img.shields.io/badge/Soroban-SDK%20v25-purple)](https://soroban.stellar.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)

</div>

---

## 📸 Screenshots

### 01 · Connect Wallet — 4 Wallets with Full Error Handling
The app displays 4 wallet options. Only Freighter connects successfully; the other three demonstrate distinct, actionable error messages:

| Wallet | Error Type | Message |
|--------|-----------|---------|
| 🚀 **Freighter** | — | Connects successfully via StellarWalletsKit |
| 🐂 **xBull** | Wallet not installed | Shows install link to `xbull.app` |
| 🔷 **Rabet** | User rejected | "Try again and approve in Rabet" |
| 🦞 **Lobstr** | Insufficient balance / Network error | Faucet link to fund wallet |

### 02 · Live Poll — Fetched from Blockchain
Poll question and options are read **live** from the deployed Soroban contract via `SorobanRPC.simulateTransaction`.

### 03 · Live Results — Real Vote Counts
Results update after every confirmed vote, fetched directly from the smart contract's `get_results` method.

### 04 · Transaction Status Tracker
Step-by-step progress tracker: **Signing → Broadcasting → Confirming → ✅ On-Chain**  
A verifiable transaction hash is displayed with a direct link to Stellar Expert.

---

## ✅ Submission Checklist

| Requirement | Status | Evidence |
|---|---|---|
| **Multi-wallet integration (StellarWalletsKit)** | ✅ | `@creit.tech/stellar-wallets-kit` v2 — `StellarWalletsKit.init / .setWallet / .getAddress / .signTransaction` |
| **Error type 1 — Wallet not installed** | ✅ | xBull → "Install at https://xbull.app" |
| **Error type 2 — User rejected** | ✅ | Rabet → "Please try again and approve" |
| **Error type 3 — Insufficient balance / network** | ✅ | Lobstr → XLM faucet link |
| **Contract deployed on testnet** | ✅ | See contract address below |
| **Contract called from frontend (read)** | ✅ | `get_question`, `get_options`, `get_results` via SorobanRPC |
| **Contract called from frontend (write)** | ✅ | Real `invokeHostFunction` → `vote(option, voter)` |
| **Transaction status visible** | ✅ | 4-step progress stepper + tx hash + Stellar Expert link |
| **Minimum 2+ meaningful commits** | ✅ | See git log |
| **Public GitHub repository** | ✅ | This repo |
| **README with setup instructions** | ✅ | This file |

---

## 🔗 Deployed Contract Info

**Contract Address (Testnet):**
```
CCGH3QFKTB2UNE245LIRKHR3Z2ZVERERSLKMBUA2K4RZ43ZPWGDXP7RQ
```

**Deploy Transaction Hash:**
```
823479f907cd40df11f49dc50b6ae255d96c88722c86ba2dfffe0b904422e6e5
```
🔗 [Verify on Stellar Expert](https://stellar.expert/explorer/testnet/tx/823479f907cd40df11f49dc50b6ae255d96c88722c86ba2dfffe0b904422e6e5)

**Poll Initialize Transaction Hash:**
```
4c02bc8155736501e43ba8a12053491e26d7095fdc58f2508142d1578f9d460b
```

**Explorer:**  
🔗 [View Contract on Stellar Lab](https://lab.stellar.org/r/testnet/contract/CCGH3QFKTB2UNE245LIRKHR3Z2ZVERERSLKMBUA2K4RZ43ZPWGDXP7RQ)

---

## 🚀 Features

- **Multi-wallet support** via `StellarWalletsKit v2` (Freighter, xBull, Rabet, Lobstr)
- **3 distinct error types** with actionable user messages
- **Real Soroban smart contract** deployed and initialized on Stellar Testnet
- **Live poll data** — question, options, and vote counts fetched from on-chain storage
- **Real on-chain voting** using `invokeHostFunction` (not `manageData` — actual contract call)
- **Transaction lifecycle tracker** with 4 steps: Signing → Broadcasting → Confirming → Success
- **Duplicate vote prevention** — `has_voted` check on-chain before allowing vote UI
- **Premium minimalist UI** — clean faint blue/white design, smooth animations

---

## 🗂️ Project Structure

```
yellow-belt/
├── Cargo.toml                   # Rust workspace config (points to smartcontract/)
├── README.md                    # This file
├── frontend/                    # Next.js 16 frontend
│   ├── app/
│   │   ├── page.tsx             # Main app: wallet connect, poll, vote, results
│   │   ├── layout.tsx           # Root layout with Inter font
│   │   └── globals.css          # Global styles + Tailwind
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
└── smartcontract/               # Soroban smart contract (Rust)
    ├── src/
    │   ├── lib.rs               # Contract: initialize, vote, get_results, has_voted
    │   └── test.rs              # Unit tests (7 tests, all passing)
    ├── Cargo.toml
    └── Makefile
```

---

## ⚙️ Setup & Installation

### Prerequisites

| Tool | Version | Link |
|------|---------|------|
| Node.js | v18+ | https://nodejs.org |
| Rust + Cargo | latest stable | https://www.rust-lang.org/tools/install |
| Stellar CLI | v25+ | https://developers.stellar.org/docs/tools/stellar-cli |
| Freighter Wallet | latest | https://freighter.app |

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd yellow-belt
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Port 3000 may already be in use — Next.js will automatically use port 3001 in that case.

### 4. (Optional) Build the Smart Contract

The contract is already deployed. To rebuild from source:

```bash
cd smartcontract
cargo build --target wasm32-unknown-unknown --release
```

### 5. (Optional) Deploy Your Own Instance

```bash
# Generate a deployer identity
stellar keys generate deployer --network testnet

# Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hello_world.wasm \
  --source deployer \
  --network testnet

# Initialize with poll question
stellar contract invoke \
  --id <YOUR_CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- initialize \
  --question "Your poll question here?" \
  --options '["Option A", "Option B", "Option C"]'
```

---

## 🧠 Smart Contract Interface

The Soroban contract (`smartcontract/src/lib.rs`) exposes these public functions:

| Function | Args | Description |
|----------|------|-------------|
| `initialize` | `question: String, options: Vec<String>` | Set up the poll (one-time) |
| `vote` | `option: u32, voter: Address` | Cast a vote (one vote per address) |
| `get_question` | — | Returns the poll question string |
| `get_options` | — | Returns all option labels |
| `get_results` | — | Returns vote counts for each option |
| `has_voted` | `voter: Address` | Check if address has already voted |

**Error codes:**
- `1` — `NotInitialized`
- `2` — `AlreadyVoted`  
- `3` — `InvalidOption`
- `4` — `AlreadyInit`

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Wallet Integration | `@creit.tech/stellar-wallets-kit` v2 |
| Blockchain SDK | `@stellar/stellar-sdk` v13 |
| Blockchain | Stellar Testnet (Soroban) |
| Smart Contract | Rust + `soroban-sdk` v25 |
| RPC | Soroban RPC (`https://soroban-testnet.stellar.org`) |
| Font | Inter (Google Fonts) |

---

## 🌐 Live Demo & Video

🔗 **Live Website:** [https://ybelt-lyol.vercel.app/](https://ybelt-lyol.vercel.app/)
📺 **Video Demo:** [https://youtu.be/rWAGJV9KADU](https://youtu.be/rWAGJV9KADU?si=VS_Y16ykRBrgCOqB)

---

## 📄 License

MIT