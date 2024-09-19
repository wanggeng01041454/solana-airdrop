import {
  Commitment,
  Connection,
  Keypair,
  PublicKey
} from "@solana/web3.js";

import * as anchor from "@coral-xyz/anchor";

import {
  BuildType,
  BaseActionParams,
  ActionResult
} from "./baseTypes";

import {
  BuildActionResultParams,
  buildActionResult
} from "./utils";

import { NonceVerify } from "../target/types/nonce_verify";

import NonceVerifyIDL from "../target/idl/nonce_verify.json";

// 合约接口类型定义
export type ProgramInitializeNonceProjectParams = anchor.IdlTypes<NonceVerify>["initializeNonceProjectParams"];
export type ProgramNonceProjectAccount = anchor.IdlTypes<NonceVerify>["nonceProject"];

export type ProgramRegisterBusinessProjectParams = anchor.IdlTypes<NonceVerify>["registerBusinessProjectParams"];
export type ProgramBusinessProjectAccount = anchor.IdlTypes<NonceVerify>["businessProject"];


// 辅助类型参数
export interface InitializeNonceProjectActionParams extends BaseActionParams {
  businessFee: number,
  userFee: number,
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 项目所属的 base 账户
  base: PublicKey,
  baseKeypair?: Keypair,

  // 项目管理员, 不需要签名
  admin?: PublicKey,
}

export interface RegisterBusinessProjectActionParams extends BaseActionParams {
  // 项目的唯一标识，使用一个公钥地址标识，可以通过随机生成一个公钥得到唯一标识符
  projectId: PublicKey,

  // 项目的 authority 账户
  projectAuthority: PublicKey,

  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 注册费支付者
  registerFeePayer: PublicKey,
  registerFeePayerKeypair?: Keypair,

  // nonce-project 的 base 账户
  nonceBase: PublicKey,

  // nonce-project 的 admin 账户，如果有
  nonceAdmin?: PublicKey,
  nonceAdminKeypair?: Keypair,
}


const NONCE_VERIFY_PROJECT_SEED = Buffer.from("nonce_verify_project");
const BUSINESS_PROJECT_SEED = Buffer.from("business_project");

/**
 * 访问 NonceVerify 合约的 provider
 */
export class NonceVerifyProvider {
  private connection: Connection;
  private program: anchor.Program<NonceVerify>;

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
    this.program = new anchor.Program(NonceVerifyIDL as NonceVerify, provider);
  }

  /**
   * @description 查找nonce-Project地址
   * @param base: project 所属的 base 账户
   * @param programId: programId
   * @returns 
   */
  public findNonceProjectAddress(base: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [NONCE_VERIFY_PROJECT_SEED, base.toBuffer()],
      this.program.programId
    )[0];
  }

  /**
   * @description 查找 BusinessProject 地址
   * @param nonceBase 
   * @param projectId 
   * @returns 
   */
  public findBusinessProjectAddress(nonceBase: PublicKey, projectId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        BUSINESS_PROJECT_SEED,
        this.findNonceProjectAddress(nonceBase).toBuffer(),
        projectId.toBuffer()
      ],
      this.program.programId
    )[0];
  }

  /**
   * @description 初始化 NonceProject
   * @param params 
   * @returns 
   */
  public async initializeNonceProjectAction(params: InitializeNonceProjectActionParams): Promise<ActionResult> {

    const initializeProjectParams: ProgramInitializeNonceProjectParams = {
      businessFee: params.businessFee,
      userFee: params.userFee,
    };

    // 构造指令
    const ix = await this.program.methods
      .initializeNonceProject(initializeProjectParams)
      .accounts({
        payer: params.payer,
        admin: params.admin ? params.admin : null,
        base: params.base
      }).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.baseKeypair]
    };

    return await buildActionResult(buildParams);
  }

  /**
   * @description 获取 NonceProject 账户
   * @param basePubkey 
   */
  public async getNonceProjectAccount(basePubkey: PublicKey): Promise<ProgramNonceProjectAccount> {
    const accountPubkey = this.findNonceProjectAddress(basePubkey);
    return await this.program.account.nonceProject.fetch(accountPubkey);
  }

  /**
   * @description 注册 BusinessProject
   * @param params 
   */
  public async registerBusinessProjectAction(params: RegisterBusinessProjectActionParams): Promise<ActionResult> {
    const registerBusinessProjectParams: ProgramRegisterBusinessProjectParams = {
      projectId: params.projectId,
    };

    // anchor 0.30.1 BUG: 所有pda账户使用字面量传递时都报错
    const accounts = {
      payer: params.payer,
      registerFeePayer: params.registerFeePayer,
      nonceAdmin: params.nonceAdmin ? params.nonceAdmin : null,
      businessAuthority: params.projectAuthority,
      nonceProject: this.findNonceProjectAddress(params.nonceBase),
      base: params.nonceBase,
      businessProject: this.findBusinessProjectAddress(params.nonceBase, params.projectId)
    };

    const ix = await this.program.methods
      .registerBusinessProject(registerBusinessProjectParams)
      .accounts(accounts).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.registerFeePayerKeypair, params.nonceAdminKeypair]
    };

    return await buildActionResult(buildParams);
  }

  /**
   * @description 获取 BusinessProject 账户
   * @param nonceBase 
   * @param projectId 
   * @returns 
   */
  public async getBusinessProjectAccount(nonceBase: PublicKey, projectId: PublicKey): Promise<ProgramBusinessProjectAccount> {
    return await this.program.account.businessProject.fetch(this.findBusinessProjectAddress(nonceBase, projectId));
  }

}
