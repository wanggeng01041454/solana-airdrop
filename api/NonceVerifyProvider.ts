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

export type ProgramVerifyUserBusinessNonceParams = anchor.IdlTypes<NonceVerify>["verifyBusinessNonceParams"];
export type ProgramUserBusinessNonceAccount = anchor.IdlTypes<NonceVerify>["userBusinessNonce"];


// 辅助类型参数
/**
 * @description 初始化 NonceProject 参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface InitializeNonceProjectActionParams extends BaseActionParams {
  // 业务费用, 默认为 0
  businessFee?: number,
  userFee?: number,

  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 项目所属的 base 账户
  base: PublicKey,
  baseKeypair?: Keypair,

  // 项目管理员, 不需要签名
  admin?: PublicKey,
}

/**
 * @description 注册 BusinessProject 参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
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

  // nonce-project 的 admin 账户
  // 如果创建 nonce-project 时指定了 admin， 则在注册 business-project 时，需要这个admin签名
  nonceAdmin?: PublicKey,
  nonceAdminKeypair?: Keypair,
}

/**
 * @description 验证用户业务 Nonce 参数; 
 * @description 很少有场景会直接使用该参数调用对应函数。 用户业务nonce通常是通过 程序间调用来进行的。如果你需要使用该参数，请清楚知道你在做什么
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface VerifyUserBusinessNonceActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 用户
  user: PublicKey,
  userKeypair?: Keypair,

  // 当前用户的 nonce
  curNonceValue: number,

  // user-fee 支付者
  userFeePayer: PublicKey,
  userFeePayerKeypair?: Keypair,

  // business project 的 account pubkey
  businessProject: PublicKey,
  // business project 的 authority
  businessProjectAuthorityKeypair: Keypair
}

const NONCE_VERIFY_PROJECT_SEED = Buffer.from("nonce_verify_project");
const BUSINESS_PROJECT_SEED = Buffer.from("business_project");
const USER_BUSINESS_NONCE_SEED = Buffer.from("user_business_nonce");


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
  public findBusinessProjectAddress(params: {
    nonceBase: PublicKey,
    projectId: PublicKey
  }): PublicKey {
    const { nonceBase, projectId } = params;
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
   * @description 查找用户业务 Nonce 地址
   * @param params 
   * @returns 
   */
  public findUserBusinessNonceAddress(params: {
    businessProject: PublicKey,
    user: PublicKey
  }): PublicKey {
    const { businessProject, user } = params;

    return PublicKey.findProgramAddressSync(
      [
        USER_BUSINESS_NONCE_SEED,
        businessProject.toBuffer(),
        user.toBuffer()
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
      businessFee: params.businessFee ? params.businessFee : 0,
      userFee: params.userFee ? params.userFee : 0,
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
      businessProject: this.findBusinessProjectAddress({
        nonceBase: params.nonceBase,
        projectId: params.projectId
      })
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
    return await this.program.account.businessProject.fetch(this.findBusinessProjectAddress({ nonceBase, projectId }));
  }

  /**
   * @description 获取用户业务 Nonce
   * 如果对应的用户业务 nonce 不存在，则返回 0
   * 如果 businessProject 不存在，则抛出异常
   * @param params.userPubkey 用户账户公钥
   * @param params.businessProject 业务工程账户公钥
   */
  public async getUserBusinessNonce(params: {
    userPubkey: PublicKey,
    businessProject: PublicKey
  }): Promise<number> {
    const { userPubkey, businessProject } = params;

    const businessProjectAccountInfo = await this.connection.getAccountInfo(businessProject);
    if (!businessProjectAccountInfo) {
      throw new Error(`businessProject: ${businessProject.toBase58()} not found`);
    }

    const userBusinessNonceAddress = this.findUserBusinessNonceAddress({ businessProject, user: userPubkey });
    const userBusinessNonceAccountInfo = await this.connection.getAccountInfo(userBusinessNonceAddress);

    if (!userBusinessNonceAccountInfo) {
      return 0;
    }

    // 解析 userBusinessNonce Account Data
    // 注意这个写法！！！ 获取AccountData后， 可以用这种方式进行解码
    const data: ProgramUserBusinessNonceAccount =
      this.program.account.userBusinessNonce.coder.accounts.decode("userBusinessNonce", userBusinessNonceAccountInfo.data);

    return data.nonceValue;
  }


  /**
   * @description 验证用户业务 Nonce
   * @description 很少有场景会直接使用该函数，用户业务nonce通常是通过 程序间调用来进行的。如果你需要使用该函数，请清楚知道你在做什么
   * @param params 
   */
  public async doVerifyUserBusinessNonce(params: VerifyUserBusinessNonceActionParams): Promise<ActionResult> {
    const verifyUserBusinessNonceParams: ProgramVerifyUserBusinessNonceParams = {
      nonceValue: params.curNonceValue
    };

    const businessProjectAccountData: ProgramBusinessProjectAccount = await this.program.account.businessProject.fetch(params.businessProject);

    const accounts = {
      payer: params.payer,
      userFeePayer: params.userFeePayer,

      nonceUser: params.user,

      nonceProject: businessProjectAccountData.nonceProject,

      authority: businessProjectAccountData.authority,
      businessProject: params.businessProject,

      userBusinessNonce: this.findUserBusinessNonceAddress({
        businessProject: params.businessProject,
        user: params.user
      }),
    };

    const ix = await this.program.methods
      .verifyBusinessNonce(verifyUserBusinessNonceParams)
      .accounts(accounts).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.userKeypair, params.userFeePayerKeypair, params.businessProjectAuthorityKeypair]
    };

    return await buildActionResult(buildParams);
  }
}
