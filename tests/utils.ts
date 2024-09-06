import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import {
  Connection,
  PublicKey,
  Keypair,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram
} from "@solana/web3.js";

/**
 * @description 构建交易
 * @param connection 
 * @param ixs 
 * @param payer 
 * @returns 
 */
export async function buildTransaction(connection: Connection, ixs: TransactionInstruction[], payer: PublicKey) {
  const latestBlockHash = await connection.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: payer,
    instructions: ixs,
    recentBlockhash: latestBlockHash.blockhash,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);

  return tx;
}

/**
 * @description 等待交易确认
 * @param connection 
 * @param txId 
 */
export async function waitTransactionFinalized(connection: Connection, txId: string) {
  const latestBlockHash = await connection.getLatestBlockhash('finalized');

  await connection.confirmTransaction({
      signature: txId,
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
  }, 'finalized');

  console.log(`transaction ${txId} finalized`);
}

/**
 * @description 发送并确认交易
 * @param params 
 * @returns 
 */
export async function mySendAndConfirmTransaction(
  params: {
    connection: Connection,
    ixs: TransactionInstruction[],
    payer: PublicKey,
    cuPrice?: number,
    signers?: Keypair[]
    extraSigner?: Wallet
  }
) {
  const { connection, ixs, payer, cuPrice, signers, extraSigner } = params;
  let tx = await buildTransaction(connection, ixs, payer);

  // 如果设置了 cuPrice，则要加 cu 限制
  if (cuPrice) {

    // 计算交易的消耗单位， cuPrice
    const info = await connection.simulateTransaction(tx, { replaceRecentBlockhash: true, commitment: "confirmed" });
    if (info.value.err || !info.value.unitsConsumed) {
      throw new Error(`simulateTransaction error: ${info.value.err}`);
    }

    let cu = Math.floor(info.value.unitsConsumed * 1.2);// 增加20%的估算值
    if ((cu - info.value.unitsConsumed) < 450) {
      cu = info.value.unitsConsumed + 450;
    }

    // 增加设置 cuPrice 和 cu 的指令
    ixs.unshift(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cuPrice }));
    ixs.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: cu }));

    // 再重新构造 tx
    tx = await buildTransaction(connection, ixs, payer);
  }

  if (signers) {
    tx.sign(signers);
  }
  if (extraSigner) {
    tx = await extraSigner.signTransaction(tx);
  }

  const txId = await connection.sendTransaction(tx);
  console.log(`send transaction: ${txId}`);
  const latestBlockHash = await connection.getLatestBlockhash("confirmed");

  await connection.confirmTransaction({
    signature: txId,
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
  }, "confirmed");

  console.log(`transaction ${txId} confirmed`);

  return txId;
}

/**
 * @description 发送并确认交易，并等待交易最终完成
 * @param params 
 * @returns 
 */
export async function mySendAndFinalizeTransaction(  params: {
  connection: Connection,
  ixs: TransactionInstruction[],
  payer: PublicKey,
  cuPrice?: number,
  signers?: Keypair[]
  extraSigner?: Wallet
}) {
  const txId = await mySendAndConfirmTransaction(params);
  await waitTransactionFinalized(params.connection, txId);
  return txId;
}