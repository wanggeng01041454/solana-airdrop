import {
  Commitment,
  Connection,
  Ed25519Program,
  Keypair,
  PublicKey,
  TransactionInstruction
} from "@solana/web3.js";
import nacl from "tweetnacl";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";

import {
  BuildType,
  BaseActionParams,
  ActionResult
} from "./baseTypes";

import {
  BuildActionResultParams,
  buildActionResult
} from "./utils";

import { SolanaAirdrop } from "../target/types/solana_airdrop";

import SolanaAirdropIDL from "../target/idl/solana_airdrop.json";
import { NonceVerifyProvider } from "./NonceVerifyProvider";



// 合约接口类型定义
export type ProgramInitializeAirdropProjectParams = anchor.IdlTypes<SolanaAirdrop>["initializeAirdropProjectParams"];
export type ProgramAirdropProjectAccount = anchor.IdlTypes<SolanaAirdrop>["airdropProject"];

export type ProgramClaimFtParams = anchor.IdlTypes<SolanaAirdrop>["claimFtParams"];


// 辅助类型参数
/**
 * @description 初始化 AirdropProject 参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface InitializeAirdropProjectActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // airdrop项目的唯一标识
  projectId: PublicKey,

  // 项目管理员, 不需要签名
  projectAdmin: PublicKey,
}

/**
 * @description 申领空投的参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface ClaimFtActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 使用 nonce-verify 服务时，如果需要支付费用，由此账户支付费用
  nonceFeePayer: PublicKey,
  nonceFeePayerKeypair?: Keypair,

  // 申领者
  claimer: PublicKey,
  claimerKeypair?: Keypair,

  // 申领者如果没有对应的token-account, 由此账户支付创建token-account的费用
  spaceFeePayer: PublicKey,
  spaceFeePayerKeypair?: Keypair,

  // 相关的 airdrop 项目
  airdropProjectPubkey: PublicKey,

  // 要申领的代币 mint-account
  // [importan!]该代币的 authority 必须设置为 findAirdropMintAuthorityAddress
  mintAccountPubkey: PublicKey,

  // 用于获取用户nonce的 business-project
  // [important] 该 project 的 authority 必须设置为 findNonceVerifyBusinessAuthorityAddress
  nonceVerifyBusinessProjectPubkey: PublicKey,

  // 申领的代币数量
  tokenAmount: BN

  // 待签名数据
  signData: Buffer
  // 对signData进行签名，生成的签名信息
  signature: Buffer
}



const AIRDROP_PROJECT_SEED = Buffer.from("ad_project");
const AIRDROP_MINT_AUTHORITY_SEED = Buffer.from("ad_mint_auth");
const AIRDROP_NONCE_VERIFY_BUSINESS_PROJECT_SEED = Buffer.from("ad_nv_biz_prj");


export class SolanaAirdropProvider {
  private connection: Connection;
  private program: anchor.Program<SolanaAirdrop>;

  private nonceVerifyProvider: NonceVerifyProvider;

  /**
   * @description 构造函数
   * @param connection 
   */
  constructor(
    connection: Connection,
    commitment?: Commitment
  ) {
    this.connection = connection;

    const options = anchor.AnchorProvider.defaultOptions();
    if (commitment) {
      options.commitment = commitment;
    }
    // 创建 anchor-provider
    const provider = new anchor.AnchorProvider(
      this.connection,
      {} as anchor.Wallet,
      options
    );

    // 可以访问合约的 program
    this.program = new anchor.Program(SolanaAirdropIDL as SolanaAirdrop, provider);

    // 创建 NonceVerifyProvider
    this.nonceVerifyProvider = new NonceVerifyProvider(connection);
  }

  /**
   * @description 获得空投项目的地址
   * @param airdropProjectId 
   * @returns 
   */
  public findAirdropProjectAddress(airdropProjectId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([
      AIRDROP_PROJECT_SEED,
      airdropProjectId.toBuffer()
    ], this.program.programId)[0];
  }

  /**
   * @description 获得被空投的mint-account的 authority 地址
   * 需要将 mint-account 的 authority 设置为该地址， 才能使用空投合约对该 mint-account 进行空投
   * @param params
   */
  public findAirdropMintAuthorityAddress(params: {
    airdropProjectPubkey: PublicKey,
    mintAccountPubkey: PublicKey
  }): PublicKey {
    return PublicKey.findProgramAddressSync([
      AIRDROP_MINT_AUTHORITY_SEED,
      params.airdropProjectPubkey.toBuffer(),
      params.mintAccountPubkey.toBuffer()
    ], this.program.programId)[0];
  }


  /**
   * @description 获得 nonce-verify-business-project 的 authority 地址
   * 需要将 nonce-verify-business-project 的 authority 设置为该地址， 才能使用 nonce-verify-business 合约对该 nonce-verify-business-project 进行操作
   * @param params 
   * @returns 
   */
  public findNonceVerifyBusinessAuthorityAddress(params: {
    airdropProjectPubkey: PublicKey
    nonceVerifyBusinessProjectPubkey: PublicKey
  }): PublicKey {
    return PublicKey.findProgramAddressSync([
      AIRDROP_NONCE_VERIFY_BUSINESS_PROJECT_SEED,
      params.airdropProjectPubkey.toBuffer(),
      params.nonceVerifyBusinessProjectPubkey.toBuffer()
    ], this.program.programId)[0];
  }

  /**
   * @description 获取空投项目的账户信息
   * @param airdropProjectPubkey 
   * @returns 
   */
  public async getAirdropProjectAccount(airdropProjectPubkey: PublicKey): Promise<ProgramAirdropProjectAccount> {
    return await this.program.account.airdropProject.fetch(airdropProjectPubkey);
  }

  /**
 * @description 初始化 NonceProject
 * @param params 
 * @returns 
 */
  public async initializeAirdropProjectAction(params: InitializeAirdropProjectActionParams): Promise<ActionResult> {
    const initializeProjectParams: ProgramInitializeAirdropProjectParams = {
      projectId: params.projectId,
      projectAdmin: params.projectAdmin,
    };

    // 构造指令
    const ix = await this.program.methods
      .initializeAirdrop(initializeProjectParams)
      .accounts({
        payer: params.payer
      }).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair]
    };

    return await buildActionResult(buildParams);
  }

  /**
   * @description 构造申领空投的签名数据
   * 期间，会从 NonceVerifyProject 中获取用户的当前nonce值
   * 被签名数据的构造顺序：[nonce, amount, mint_address, user_address, airdrop_project_address, nonce_business_project_address]
   * @param params 
   * 
   * @returns 返回包含待签名数据的 Buffer
   */
  public async buildClaimFtSignData(params: {
    airdropProjectPubkey: PublicKey,
    nonceVerifyBusinessProjectPubkey: PublicKey,
    claimer: PublicKey,
    mintAccountPubkey: PublicKey,
    tokenAmount: BN
  }): Promise<Buffer> {

    // 获取nonce
    const nonceInfo = await this.nonceVerifyProvider.getUserBusinessNonceValue({
      userPubkey: params.claimer,
      businessProject: params.nonceVerifyBusinessProjectPubkey
    });

    // 创建一个空的 Buffer 数组
    let signData = Buffer.alloc(0);

    // 将 nonce 转换为小端字节序并添加到 signData
    const nonceBuffer = Buffer.alloc(4);
    nonceBuffer.writeUInt32LE(nonceInfo.nonceValue, 0);
    signData = Buffer.concat([signData, nonceBuffer]);

    // 将 amount 转换为小端字节序并添加到 signData
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(params.tokenAmount.toString()), 0);
    signData = Buffer.concat([signData, amountBuffer]);

    // 添加 mint 公钥的字节数组到 signData
    signData = Buffer.concat([signData, params.mintAccountPubkey.toBuffer()]);

    // 添加 claim_user 公钥的字节数组到 signData
    signData = Buffer.concat([signData, params.claimer.toBuffer()]);

    // 添加 airdrop_project 公钥的字节数组到 signData
    signData = Buffer.concat([signData, params.airdropProjectPubkey.toBuffer()]);

    // 添加 business_project 公钥的字节数组到 signData
    signData = Buffer.concat([signData, params.nonceVerifyBusinessProjectPubkey.toBuffer()]);

    return signData;
  }

  /**
   * @description 申领空投
   * @param params 
   * @returns 
   */
  public async claimFtAction(params: ClaimFtActionParams): Promise<ActionResult> {

    let ixs: TransactionInstruction[] = [];
    let signers: Keypair[] = [];

    // 获取nonce
    const nonceInfo = await this.nonceVerifyProvider.getUserBusinessNonceValue({
      userPubkey: params.claimer,
      businessProject: params.nonceVerifyBusinessProjectPubkey
    });

    // 如果 nonce 账户不存在， 则需要初始化 nonce
    if (!nonceInfo.isExist) {
      const initNonceIxs = await this.nonceVerifyProvider.initUserBusinessNonceStateAction({
        buildType: BuildType.InstructionArray,
        payer: params.payer,
        user: params.claimer,
        businessProject: params.nonceVerifyBusinessProjectPubkey
      }) as TransactionInstruction[];

      ixs = ixs.concat(initNonceIxs);
      signers.push(params.payerKeypair);
      signers.push(params.claimerKeypair);
    }

    const claimFtParams: ProgramClaimFtParams = {
      amount: params.tokenAmount,
      nonce: nonceInfo.nonceValue,
      signature: params.signature
    }

    const userBusinessNonceAccountAddress = await this.nonceVerifyProvider.findUserBusinessNonceAccountAddress({
      businessProject: params.nonceVerifyBusinessProjectPubkey,
      user: params.claimer
    });
    const businessProjectAccount = await this.nonceVerifyProvider.getBusinessProjectAccount(params.nonceVerifyBusinessProjectPubkey);

    const airdropProjectAccount = await this.getAirdropProjectAccount(params.airdropProjectPubkey);

    const accounts = {
      payer: params.payer,
      nonceFeePayer: params.nonceFeePayer,
      claimUser: params.claimer,
      spaceFeePayer: params.spaceFeePayer,
      airdropProject: params.airdropProjectPubkey,
      mint: params.mintAccountPubkey,
      nonceProject: businessProjectAccount.nonceProject,
      businessProject: params.nonceVerifyBusinessProjectPubkey,
      businessProjectAuthority: businessProjectAccount.businessProjectAuthority,
      userBusinessNonce: userBusinessNonceAccountAddress
    };

    // 使用 ed25519 验证签名的指令
    {
      const PubkeyLen = 32;
      const SignatureLen = 64;
      const publicKeyOffset = 2 * 1 + 7 * 2; // size_of<u8> == 1, size_of<u16> == 2
      const signatureOffset = publicKeyOffset + PubkeyLen; // public_key size == 32
      const messageOffset = signatureOffset + SignatureLen; // signature size == 64

      const ixData: Buffer = Buffer.alloc(messageOffset + params.signData.length);

      // 填充数据
      ixData.writeUInt8(1, 0); // num of signatures
      ixData.writeUInt8(0, 1); // padding

      ixData.writeUInt16LE(signatureOffset, 2); // signature offset
      ixData.writeUInt16LE(0xFFFF, 4); // signature instruction index

      ixData.writeUInt16LE(publicKeyOffset, 6); // public key offset
      ixData.writeUInt16LE(0xFFFF, 8); // public key instruction index

      ixData.writeUInt16LE(messageOffset, 10); // message offset
      ixData.writeUInt16LE(params.signData.length, 12); // message length
      ixData.writeUInt16LE(0xFFFF, 14); // message instruction index

      // 添加公钥、签名和消息
      ixData.set(airdropProjectAccount.airdropProjectAdmin.toBuffer(), publicKeyOffset);
      ixData.set(params.signature, signatureOffset);
      ixData.set(params.signData, messageOffset);

      const ed25519Ix = new TransactionInstruction({
        keys: [],
        programId: Ed25519Program.programId,
        data: ixData
      });

      ixs.push(ed25519Ix);
    }

    // claimFt 指令
    const ix = await this.program.methods.claimFt(claimFtParams).accounts(accounts).instruction();
    ixs.push(ix);
    signers.push(params.payerKeypair, params.nonceFeePayerKeypair, params.claimerKeypair, params.spaceFeePayerKeypair);

    // 使用 set 对 signers 去重
    signers = Array.from(new Set(signers));

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: ixs,
      payer: params.payer,
      signers: signers
    };

    return await buildActionResult(buildParams);
  }
}


/**
 * @description 空投工具类函数汇总
 */
export class AirdropUtils {

  /**
   * 使用私钥对数据进行签名
   * @param data 
   * @param keypair 
   * @returns 
   */
  public static sign(data: Buffer, keypair: Keypair): Buffer {
    const signature = nacl.sign.detached(data, keypair.secretKey);
    return Buffer.from(signature);
  }
}




