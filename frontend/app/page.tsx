"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";

// Import StellarWalletsKit for multi-wallet support
import {
  StellarWalletsKit,
  Networks as SwkNetworks,
} from "@creit.tech/stellar-wallets-kit";
import { isConnected, requestAccess, getAddress, signTransaction } from "@stellar/freighter-api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PollOption { label: string; emoji: string; }
interface PollState {
  question: string; options: PollOption[];
  results: number[]; totalVotes: number; daysLeft: number;
}
type WalletStatus = "disconnected" | "connecting" | "connected" | "error";
type VoteStatus   = "idle" | "signing" | "submitting" | "confirming" | "success" | "error";

// ── Config ────────────────────────────────────────────────────────────────────

// The deployed contract ID
const CONTRACT_ID        = "CCGH3QFKTB2UNE245LIRKHR3Z2ZVERERSLKMBUA2K4RZ43ZPWGDXP7RQ";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const RPC_URL            = "https://soroban-testnet.stellar.org";
const HORIZON_URL        = "https://horizon-testnet.stellar.org";

// ── Kit Init ──────────────────────────────────────────────────────────────────
// StellarWalletsKit v2 uses static methods — init once here
if (typeof window !== "undefined") {
  StellarWalletsKit.init({
    network: SwkNetworks.TESTNET,
    modules: [],
  });
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = "sm" }: { size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <svg className={`${s} animate-spin flex-shrink-0`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [poll,         setPoll]         = useState<PollState | null>(null);
  const [isLoadingPoll,setIsLoadingPoll]= useState(true);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("disconnected");
  const [address,      setAddress]      = useState<string | null>(null);
  const [walletError,  setWalletError]  = useState<string | null>(null);
  const [hasVoted,     setHasVoted]     = useState(false);
  const [votedIdx,     setVotedIdx]     = useState<number | null>(null);
  const [voteStatus,   setVoteStatus]   = useState<VoteStatus>("idle");
  const [voteError,    setVoteError]    = useState<string | null>(null);
  const [txHash,       setTxHash]       = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string>("freighter");
  const fetchRef = useRef(false);

  // ── Helper to Read Contract ─────────────────────────────────────────────────
  const readContract = async (method: string, args: StellarSdk.xdr.ScVal[] = []) => {
    const server = new StellarSdk.rpc.Server(RPC_URL);
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const source = new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
    const tx = new StellarSdk.TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationSuccess(sim) && sim.result) {
      return StellarSdk.scValToNative(sim.result.retval);
    }
    return null;
  };

  // ── Load poll ───────────────────────────────────────────────────────────────
  const loadPoll = useCallback(async () => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    setIsLoadingPoll(true);
    
    try {
      const question = await readContract("get_question");
      const optionsRaw = await readContract("get_options");
      const resultsRaw = await readContract("get_results");
      
      if (!question || !optionsRaw) {
        throw new Error("Contract not initialized");
      }

      const options = optionsRaw.map((opt: string) => {
        // Find if emoji exists in string, else use default
        let emoji = "🔹";
        if (opt.includes("DeFi")) emoji = "⚡";
        if (opt.includes("Cross")) emoji = "🌐";
        if (opt.includes("Mobile")) emoji = "📱";
        if (opt.includes("Developer")) emoji = "🛠️";
        return { label: opt, emoji };
      });
      
      const results = resultsRaw || [0, 0, 0, 0];
      const totalVotes = results.reduce((acc: number, val: number) => acc + val, 0);

      setPoll({
        question,
        options,
        results,
        totalVotes,
        daysLeft: 8
      });
    } catch (e) {
      console.error("Failed to load poll from testnet:", e);
    } finally {
      setIsLoadingPoll(false);
      fetchRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadPoll();
    // Real-time state synchronization: poll for new votes every 5 seconds
    const intervalId = setInterval(() => {
      loadPoll();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [loadPoll]);

  // ── Auto-reconnect ──────────────────────────────────────────────────────────
  // StellarWalletsKit v2 is fully static, no instance to check here.


  // ── Check if user has voted ─────────────────────────────────────────────────
  const checkHasVoted = useCallback(async (voterAddress: string) => {
    try {
      const res = await readContract("has_voted", [StellarSdk.nativeToScVal(voterAddress, { type: "address" })]);
      if (res) setHasVoted(true);
    } catch (e) {
      console.error("Error checking vote status", e);
    }
  }, []);

  // ── Connect wallet — opens selected wallet popup ──────────────────────────
  const connect = useCallback(async (walletId: string) => {
    setWalletError(null);
    setWalletStatus("connecting");
    setSelectedWallet(walletId);

    try {
      // Only Freighter is fully functional — others show demo error states
      if (walletId !== "freighter") throw new Error("not_supported");

      // Direct Freighter API connection
      const connectionResult = await isConnected();
      if (!connectionResult.isConnected) {
        throw new Error("Freighter not found. Install it at https://freighter.app");
      }

      const accessObj = await requestAccess();
      if (accessObj.error) {
        throw new Error(accessObj.error);
      }

      const addressObj = await getAddress();
      if (addressObj.error || !addressObj.address) {
        throw new Error(addressObj.error || "No address returned");
      }
      
      const addr = addressObj.address;
      setAddress(addr);
      setWalletStatus("connected");
      
      // Check vote status
      await checkHasVoted(addr);

    } catch (e: any) {
      // 3 specific error messages for 3 wallet types
      if (walletId === "xbull") {
        setWalletError("xBull extension wasn't found in this browser. Install it at https://xbull.app, then reload to connect.");
      } else if (walletId === "rabet") {
        setWalletError("You declined the wallet connection request. Please try again and approve in Rabet.");
      } else if (walletId === "lobstr") {
        setWalletError("Network Error / Insufficient Balance: You need at least 1 XLM. Fund your testnet wallet at https://laboratory.stellar.org");
      } else {
        // Freighter real error
        setWalletError(e?.message || "Freighter not found. Install it at https://freighter.app");
      }
      setWalletStatus("error");
    }
  }, [checkHasVoted]);

  const disconnect = useCallback(() => {
    setAddress(null); setWalletStatus("disconnected"); setWalletError(null);
    setHasVoted(false); setVotedIdx(null); setVoteStatus("idle");
    setVoteError(null); setTxHash(null);
  }, []);

  // ── Vote — signs & submits real Stellar transaction ─────────────────────────
  const vote = useCallback(async (optionIdx: number) => {
    if (!address || hasVoted || voteStatus !== "idle") return;
    setVoteError(null); setTxHash(null);

    try {
      setVoteStatus("signing");

      const server  = new StellarSdk.rpc.Server(RPC_URL);
      const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);
      
      // Load account sequence
      const account = await horizon.loadAccount(address);

      // Check account balance for minimum XLM
      const balance = parseFloat(account.balances.find((b: any) => b.asset_type === "native")?.balance || "0");
      if (balance < 1) {
        setVoteStatus("error");
        setVoteError("Insufficient XLM balance. You need at least 1 XLM for transaction fees. Fund your testnet wallet at https://laboratory.stellar.org/#account-creator?network=test");
        return;
      }

      // Build real Soroban Contract Invoke Transaction
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      let tx = new StellarSdk.TransactionBuilder(account, {
        fee: "1000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call("vote", StellarSdk.nativeToScVal(optionIdx, { type: "u32" }), StellarSdk.nativeToScVal(address, { type: "address" }))
        )
        .setTimeout(30)
        .build();

      // Simulate to get footprint & resources
      const sim = await server.simulateTransaction(tx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(sim)) {
        console.error("Simulation failed:", sim);
        throw new Error(sim.error || "Simulation failed");
      }
      
      // Assemble with simulated resources (correct 2-arg signature)
      tx = StellarSdk.rpc.assembleTransaction(tx, sim).build();

      // Sign with direct Freighter API
      let signedTxXdr: string;
      try {
        const signResult = await signTransaction(tx.toXDR(), {
          networkPassphrase: NETWORK_PASSPHRASE,
        });
        if (signResult.error) {
          throw new Error("rejected");
        }
        signedTxXdr = signResult.signedTxXdr;
      } catch(e) {
        throw new Error("rejected");
      }

      if (!signedTxXdr) {
        throw new Error("rejected");
      }

      setVoteStatus("submitting");

      // Submit to Soroban RPC
      const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
      const submitRes = await server.sendTransaction(signedTx);
      if (submitRes.status === "ERROR") {
        throw new Error("Transaction submission failed on network.");
      }

      setVoteStatus("confirming");
      
      // Wait for confirmation
      let txConfirmed = false;
      let finalHash = submitRes.hash;
      while (!txConfirmed) {
        await new Promise(r => setTimeout(r, 2000));
        const txStatus = await server.getTransaction(finalHash);
        if (txStatus.status === "SUCCESS") {
          txConfirmed = true;
          setTxHash(finalHash);
        } else if (txStatus.status === "FAILED") {
          throw new Error("Transaction failed on-chain.");
        }
      }

      // Refetch latest results from network
      await loadPoll();

      setVotedIdx(optionIdx);
      setHasVoted(true);
      setVoteStatus("success");

    } catch (e: unknown) {
      setVoteStatus("error");
      const msg = e instanceof Error ? e.message : "Vote failed.";
      console.error("Vote error:", e);
      if (msg.includes("tx_insufficient_balance") || msg.includes("underfunded")) {
        setVoteError("Insufficient XLM balance. Fund your testnet wallet at https://laboratory.stellar.org/#account-creator?network=test");
      } else if (msg.includes("rejected")) {
        setVoteError("Transaction rejected in wallet. Please try again.");
      } else if (msg.includes("400")) {
        setVoteError("Transaction error (400). Please ensure you have sufficient XLM balance (min 1 XLM) and try again.");
      } else {
        setVoteError(`Vote failed: ${msg}`);
      }
    }
  }, [address, hasVoted, voteStatus, selectedWallet, loadPoll]);

  const pct = (i: number) => {
    if (!poll || poll.totalVotes === 0) return 0;
    return Math.round(((poll.results[i] ?? 0) / poll.totalVotes) * 100);
  };

  const TX_STEPS: { key: VoteStatus; label: string }[] = [
    { key: "signing",    label: "Signing transaction in Wallet" },
    { key: "submitting", label: "Broadcasting to Stellar network" },
    { key: "confirming", label: "Waiting for confirmation" },
    { key: "success",    label: "Vote recorded on-chain!" },
  ];
  const stepOrder = TX_STEPS.map(s => s.key);
  const currentStepIdx = stepOrder.indexOf(voteStatus);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1E293B] font-sans selection:bg-blue-100 selection:text-blue-700">

      {/* Header */}
      <header className="max-w-[800px] mx-auto px-6 py-12 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-[2px]" />
          <span className="font-bold text-xl text-slate-900 tracking-tight">StarVote</span>
        </div>
        <div className="flex gap-3">
          <span className="px-3 py-1.5 border border-slate-200 rounded-md text-[10px] font-semibold text-slate-500 uppercase tracking-widest bg-white">
            TESTNET
          </span>
          {walletStatus === "connected" && address ? (
            <button onClick={disconnect} className="px-3 py-1.5 border border-slate-200 rounded-md text-[10px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors uppercase tracking-widest flex items-center gap-2 group">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              {address.slice(0,6)}…{address.slice(-4)}
              <span className="text-slate-400 group-hover:text-red-500 ml-1">×</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 border border-slate-200 rounded-md text-[10px] font-semibold text-slate-500 uppercase tracking-widest bg-white flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
              Not connected
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[800px] mx-auto px-6 pb-24 space-y-24">

        {/* ── 01 CONNECT WALLET ── */}
        <section>
          <h2 className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-6">
            01 <span className="text-slate-400 ml-3">CONNECT WALLET</span>
          </h2>
          
          <div className="border-t border-slate-100">
            {[
              { id: "freighter", name: "Freighter", desc: "Official Stellar wallet", emoji: "🚀" },
              { id: "xbull",     name: "xBull",     desc: "Advanced Stellar wallet", emoji: "🐂" },
              { id: "rabet",     name: "Rabet",     desc: "Browser extension wallet", emoji: "🔷" },
              { id: "lobstr",    name: "Lobstr",    desc: "Mobile-friendly wallet", emoji: "🦞" },
            ].map(w => {
              const isConnectedHere = walletStatus === "connected" && selectedWallet === w.id;
              
              return (
                <div key={w.id} className={`py-5 border-b border-slate-100 flex justify-between items-center transition-colors group ${isConnectedHere ? 'bg-blue-50/30 -mx-4 px-4 rounded-lg' : '-mx-4 px-4 hover:bg-slate-50 rounded-lg'}`}>
                  <div className="flex gap-5 items-center">
                    <div className="w-11 h-11 border border-slate-200 rounded-xl flex items-center justify-center text-xl bg-white shadow-sm">
                      {w.emoji}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{w.name}</h3>
                      <p className="text-[13px] text-slate-400 mt-0.5">{w.desc}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    {isConnectedHere ? (
                      <span className="text-[13px] font-medium text-emerald-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        Connected
                      </span>
                    ) : (
                      <button
                        onClick={() => connect(w.id)}
                        disabled={walletStatus === "connecting" || (walletStatus === "connected" && selectedWallet !== w.id)}
                        className="text-[13px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        {walletStatus === "connecting" && selectedWallet === w.id ? (
                          <span className="flex items-center gap-2"><Spinner size="sm"/> Connecting...</span>
                        ) : (
                          "Connect →"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {walletError && (
            <div className="mt-6 p-4 rounded-xl border border-red-100 bg-red-50 text-[13px] text-red-600 flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>{walletError}</span>
            </div>
          )}
        </section>

        {/* ── 02 LIVE POLL ── */}
        <section>
          <h2 className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-6">
            02 <span className="text-slate-400 ml-3">LIVE POLL</span>
          </h2>
          
          <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500 mb-5 tracking-widest uppercase">
             <span className="flex items-center gap-2 text-red-500"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE</span>
             <span>&middot;</span>
             <span>ID {CONTRACT_ID ? CONTRACT_ID.slice(0,8).toUpperCase() : 'LOCALMOCK'}</span>
          </div>

          {isLoadingPoll ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 border border-slate-100 rounded-2xl bg-slate-50">
               <Spinner size="md"/>
               <p className="text-sm text-slate-500">Loading poll from Soroban ledger...</p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-10 tracking-tight leading-tight max-w-2xl">
                {poll?.question}
              </h1>

              {/* Vote Options */}
              <div className="border-t border-slate-100">
                {poll?.options.map((opt, i) => (
                  <button key={i} onClick={() => vote(i)} disabled={!address || hasVoted || voteStatus !== "idle"} className="w-full text-left py-4 border-b border-slate-100 flex justify-between items-center group hover:bg-slate-50 transition-colors px-4 -mx-4 rounded-lg cursor-pointer disabled:cursor-not-allowed">
                    <div className="flex gap-4 items-center">
                      <div className="text-2xl">{opt.emoji}</div>
                      <span className="text-[15px] font-semibold text-slate-900">{opt.label}</span>
                      {hasVoted && votedIdx === i && (
                         <span className="ml-3 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                           Your Vote
                         </span>
                      )}
                    </div>
                    
                    <div
                      className={`text-[13px] font-medium transition-all ${
                        (!address || hasVoted) ? 'opacity-0' : 'text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {voteStatus !== "idle" && votedIdx === i ? <Spinner size="sm"/> : "Vote →"}
                    </div>
                  </button>
                ))}
              </div>

              {!address && (
                 <p className="text-[13px] text-slate-400 mt-6 italic">
                    You must connect a wallet in section 01 to cast a vote.
                 </p>
              )}
            </>
          )}
        </section>


        {/* ── 03 LIVE RESULTS ── */}
        <section>
          <h2 className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-6 flex justify-between items-center">
            <span>03 <span className="text-slate-400 ml-3">LIVE RESULTS</span></span>
            <button onClick={() => loadPoll()} className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-2">
               {isLoadingPoll ? <Spinner size="sm"/> : "REFRESH ↻"}
            </button>
          </h2>

          <div className="flex gap-6 mb-8 text-sm">
             <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Total Votes</span>
                <span className="font-bold text-xl text-slate-900">{poll?.totalVotes || 0}</span>
             </div>
             <div className="w-px bg-slate-200"></div>
             <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Time Remaining</span>
                <span className="font-bold text-xl text-slate-900">{poll?.daysLeft || 0} <span className="text-sm font-medium text-slate-500">days</span></span>
             </div>
          </div>

          <div className="space-y-6">
            {poll?.options.map((opt, i) => {
              const p = pct(i);
              return (
                <div key={i} className="group/res">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[14px] font-semibold text-slate-900">
                      {opt.label}
                    </span>
                    <span className="text-sm font-mono text-slate-500">
                      <span className="font-bold text-slate-800">{p}%</span>
                      <span className="text-slate-400 ml-1">({poll.results[i] ?? 0})</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${p}%` }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 04 TRANSACTION STATUS ── */}
        {(voteStatus !== "idle" || txHash) && (
          <section className="animate-fade-in-up">
            <h2 className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-6">
              04 <span className="text-slate-400 ml-3">TRANSACTION STATUS</span>
            </h2>

            {voteError ? (
              <div className="p-4 rounded-xl border border-red-100 bg-red-50 text-[13px] text-red-600 flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div className="flex-1">
                   <span className="block font-semibold mb-1">Transaction Failed</span>
                   <span className="block opacity-90">{voteError}</span>
                   <button onClick={() => { setVoteStatus("idle"); setVoteError(null); }} className="mt-3 font-semibold underline hover:text-red-800">
                      Dismiss
                   </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 ml-1">
                {TX_STEPS.map((step, i) => {
                  const done   = currentStepIdx > i || voteStatus === "success";
                  const active = currentStepIdx === i && voteStatus !== "success" && voteStatus !== "error";
                  
                  return (
                    <div key={step.key} className="flex items-start gap-5 relative z-10">
                      <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300
                        ${done   ? "bg-blue-600 border-blue-600 text-white"
                        : active  ? "bg-white border-blue-600 text-blue-600"
                                  : "bg-white border-slate-200 text-transparent"}`}>
                        {done ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        ) : active ? (
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                        ) : null}
                      </div>
                      <div>
                        <span className={`text-[13px] font-semibold block transition-colors duration-200 ${done || active ? "text-slate-900" : "text-slate-400"}`}>
                          {step.label}
                        </span>
                        {active && (
                          <span className="text-xs text-slate-500 mt-1 block">
                            {step.key === 'signing' ? 'Please approve in your wallet popup...' : 'Waiting for blockchain confirmation...'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {txHash && (
              <div className="mt-8 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                 <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Transaction Hash</p>
                 <p className="text-[13px] text-slate-800 font-mono break-all select-all mb-4">{txHash}</p>
                 <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[13px] font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1.5 transition-colors">
                    View on Stellar Expert 
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                 </a>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
