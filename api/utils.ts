import {
  Connection,
  PublicKey,
  Keypair,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram
} from "@solana/web3.js";

import {
  BaseActionParams,
  ActionResult,
  BuildType,
  DEFAULT_CU_FACTOR
} from "./baseTypes";

export interface BuildActionResultParams extends BaseActionParams {
  connection: Connection,
  ixs: TransactionInstruction[],
  payer: PublicKey,
  signers?: Keypair[]
}

/**
 * @description 构建 ActionResult, 该函数是各个Action的通用函数
 * @param param 
 * @returns 
 */
export async function buildActionResult(param: BuildActionResultParams): Promise<ActionResult> {
  switch (param.buildType) {
    case BuildType.InstructionArray: {
      return param.ixs;
    }
    case BuildType.VersionMsg: {
      const tx = await buildTransaction(param.connection, param.ixs, param.payer);
      return tx.message;
    }
    case BuildType.VersionTx: {
      return await buildTransaction(param.connection, param.ixs, param.payer);
    }
    case BuildType.SendAndConfirmTx: {
      return await mySendAndConfirmTransaction(param);
    }
    case BuildType.SendAndFinalizeTx: {
      return await mySendAndFinalizeTransaction(param);
    }
    default: {
      throw new Error(`invalid build type: ${param.buildType}`);
    }
  }
}

/**
 * @description 构建 VersionedTransaction
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
    cuPrice?: number, // cu 价格, 为空时，则不附加cu限制
    cuFactor?: number, // cu 估算因子, 默认 1.2
    signers?: Keypair[]
  }
) {
  const { connection, ixs, payer, cuPrice, cuFactor, signers } = params;
  let tx = await buildTransaction(connection, ixs, payer);

  // 如果设置了 cuPrice，则要加 cu 限制
  if (cuPrice) {

    // 计算交易的消耗单位， cuPrice
    const info = await connection.simulateTransaction(tx, { replaceRecentBlockhash: true, commitment: "confirmed" });
    if (info.value.err || !info.value.unitsConsumed) {
      const simulateReult = `${JSON.stringify(info, null, 2)}`;
      throw new Error(`simulateTransaction error, simulate full result:\n ${simulateReult}`);
    }
    const localCuFactor = cuFactor ? cuFactor : DEFAULT_CU_FACTOR;
    let cu = Math.floor(info.value.unitsConsumed * localCuFactor);
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
    // 去除 undefined 和 null
    let tmpSigners = signers.filter((item) => {
      return (item !== undefined) && (item !== null);
    }) as Keypair[];

    // 去重
    tmpSigners = Array.from(new Set(tmpSigners));

    if (tmpSigners.length > 0) {
      tx.sign(tmpSigners);
    }
  }

  const txId = await connection.sendTransaction(tx);
  const latestBlockHash = await connection.getLatestBlockhash("confirmed");

  await connection.confirmTransaction({
    signature: txId,
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
  }, "confirmed");

  return txId;
}

/**
 * @description 发送并确认交易，并等待交易最终完成
 * @param params 
 * @returns 
 */
export async function mySendAndFinalizeTransaction(params: {
  connection: Connection,
  ixs: TransactionInstruction[],
  payer: PublicKey,
  cuPrice?: number,
  signers?: Keypair[]
}) {
  const txId = await mySendAndConfirmTransaction(params);
  await waitTransactionFinalized(params.connection, txId);
  return txId;
}