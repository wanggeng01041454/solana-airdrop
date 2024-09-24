import {
  Keypair,
  PublicKey
} from "@solana/web3.js";

import * as anchor from "@coral-xyz/anchor";

import {
  InitializeNonceProjectActionParams,
  NonceVerifyProvider,
  RegisterBusinessProjectActionParams
} from "../api/NonceVerifyProvider";

import {
  BuildType,
  DEFAULT_CU_FACTOR
} from "../api/baseTypes";
import { mySendAndFinalizeTransaction } from "../api/utils";

import { spawn } from 'child_process';

/**
 * @description 专门用于测试的初始化 NonceVerifyProject
 * @param params 
 */
export async function initNonceVerifyProject4Test(params: {
  provider: NonceVerifyProvider,
  pyaerKeypair: Keypair,
  baseKeypair: Keypair,
  adminKeypair?: Keypair,
  userFee?: number,
  businessFee?: number,
}): Promise<string> {
  const {
    provider,
    pyaerKeypair,
    baseKeypair,
    adminKeypair,
    userFee,
    businessFee
  } = params;

  const initializeProjectParams: InitializeNonceProjectActionParams = {
    buildType: BuildType.SendAndFinalizeTx,
    cuPrice: 1 * 10 ** 6,
    cuFactor: DEFAULT_CU_FACTOR,

    businessFee: businessFee,
    userFee: userFee,
    payer: pyaerKeypair.publicKey,
    payerKeypair: pyaerKeypair,

    base: baseKeypair.publicKey,
    baseKeypair: baseKeypair,

    admin: adminKeypair?.publicKey,
  };


  const txId = await provider.initializeNonceProjectAction(initializeProjectParams) as string;
  console.log(`initialize-nonce-project transaction txId: ${txId}, has finitialized`);

  return txId;
}

/**
 * @description 专门用于测试的注册 BusinessProject
 * @param params 
 */
export async function registerBusinessProject4Test(params: {
  provider: NonceVerifyProvider,
  pyaerKeypair: Keypair,
  baseKeypair: Keypair,
  adminKeypair?: Keypair,
  projectId: PublicKey,
  projectAuthorityPubkey: PublicKey,
}): Promise<string> {
  const { provider, pyaerKeypair, baseKeypair, adminKeypair, projectId, projectAuthorityPubkey } = params;

  const registerBusinessProjectParams: RegisterBusinessProjectActionParams = {
    buildType: BuildType.SendAndFinalizeTx,
    cuPrice: 1 * 10 ** 6,
    cuFactor: DEFAULT_CU_FACTOR,

    projectId: projectId,
    projectAuthority: projectAuthorityPubkey,

    payer: pyaerKeypair.publicKey,
    payerKeypair: pyaerKeypair,
    registerFeePayer: pyaerKeypair.publicKey,
    registerFeePayerKeypair: pyaerKeypair,

    nonceBase: baseKeypair.publicKey,

    nonceAdmin: adminKeypair?.publicKey,
    nonceAdminKeypair: adminKeypair,
  };

  const txId = await provider.registerBusinessProjectAction(registerBusinessProjectParams) as string;
  console.log(`register-business-project transaction txId: ${txId}, has finitialized`);

  return txId;
}

/**
 * @description 专门用于测试的初始化 NonceVerifyProject并注册 BusinessProject
 * 将两个操作放在一个函数里完成
 * @param params 
 * @returns txId1, 是初始化 NonceVerifyProject 的交易id
 * @returns txId2, 是注册 BusinessProject 的交易id
 */
export async function initNonceProjectAndRegisterBusinessProject4Test(params: {
  provider: NonceVerifyProvider,
  pyaerKeypair: Keypair,
  baseKeypair: Keypair,
  adminKeypair?: Keypair,
  userFee?: number,
  businessFee?: number,

  projectId: PublicKey,
  projectAuthorityPubkey: PublicKey,
}): Promise<{ txId1: string, txId2: string }> {
  const { provider, pyaerKeypair, baseKeypair, adminKeypair, userFee, businessFee, projectId, projectAuthorityPubkey } = params;

  const txId1 = await initNonceVerifyProject4Test({
    provider,
    pyaerKeypair,
    baseKeypair,
    adminKeypair,
    userFee,
    businessFee,
  });

  const txId2 = await registerBusinessProject4Test({
    provider,
    pyaerKeypair,
    baseKeypair,
    adminKeypair,
    projectId,
    projectAuthorityPubkey,
  });

  return { txId1, txId2 };
}


export async function transferSol(params: {
  connection: anchor.web3.Connection,
  fromKeypair: Keypair,
  toPubkey: PublicKey,
  amountInSol: number
}): Promise<string> {
  const { connection, fromKeypair, toPubkey, amountInSol } = params;

  const ix = anchor.web3.SystemProgram.transfer({
    fromPubkey: fromKeypair.publicKey,
    toPubkey: toPubkey,
    lamports: amountInSol * 10 ** 9
  });

  const txId = await mySendAndFinalizeTransaction({
    connection: connection,
    ixs: [ix],
    payer: fromKeypair.publicKey,
    cuPrice: 1 * 10 ** 6,
    signers: [fromKeypair]
  });

  return txId
}

/**
 * @description 运行一个命令行程序，并获取其标准输出
 * @param cmdPath 
 * @param args 
 * @returns 
 */
export function runAppAndGetStdout(cmdPath: string, args: string[]): Promise<string> {

  return new Promise((resolve, reject) => {
      const child = spawn(cmdPath, args);
      console.log(`run cmd: ${cmdPath} ${args.join(' ')}`);

      let output = '';
      let errorOutput = '';

      // 获取标准输出
      child.stdout.on('data', (data) => {
          output += data.toString();
          // console.log(`stdout: ${data}`);
      });

      // 获取标准错误输出
      child.stderr.on('data', (data) => {
          errorOutput += data.toString();
      });

      // 进程结束时的处理
      child.on('close', (code) => {
          if (code === 0) {
              resolve(output); // 返回标准输出
          } else {
              reject(new Error(`子进程退出，退出码: ${code}\n错误输出: ${errorOutput}`));
          }
      });
  });
}

