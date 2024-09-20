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
  projectAuthorityKeypair: Keypair,
}): Promise<string> {
  const { provider, pyaerKeypair, baseKeypair, adminKeypair, projectId, projectAuthorityKeypair } = params;

  const registerBusinessProjectParams: RegisterBusinessProjectActionParams = {
    buildType: BuildType.SendAndFinalizeTx,
    cuPrice: 1 * 10 ** 6,
    cuFactor: DEFAULT_CU_FACTOR,

    projectId: projectId,
    projectAuthority: projectAuthorityKeypair.publicKey,

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
  projectAuthorityKeypair: Keypair,
}): Promise<{ txId1: string, txId2: string }> {
  const { provider, pyaerKeypair, baseKeypair, adminKeypair, userFee, businessFee, projectId, projectAuthorityKeypair } = params;

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
    projectAuthorityKeypair,
  });

  return { txId1, txId2 };
}
