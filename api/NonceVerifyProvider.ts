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
export type ProgramUserBusinessNonceStateAccount = anchor.IdlTypes<NonceVerify>["userBusinessNonceState"];

export type ProgramClaimNonceFeeParams = anchor.IdlTypes<NonceVerify>["claimNonceFeeParams"];

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
 * @description 初始化用户业务 Nonce State
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface InitUserBusinessNonceStateActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 用户
  user: PublicKey,
  userKeypair?: Keypair,

  // business project 的 account pubkey
  businessProject: PublicKey,
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

/**
 * @description 关闭 UserBusinessNonceAccount 的参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface CloseUserBusinessNonceActionParams extends BaseActionParams {
  // 交易费支付者
  nonceUser: PublicKey,
  nonceUserKeypair?: Keypair,

  // 相关的 airdrop 项目
  userBusinessNonceAccountPubkey: PublicKey,
}

/**
 * @description 领取 nonce 交易费
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface ClaimNonceFeeActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // fee 接收者
  receiverPubkey: PublicKey,

  // nonce-project 的 base 账户
  nonceProjectBase: PublicKey,
  nonceProjectBaseKeypair?: Keypair,

  // 要领取的金额
  amount: anchor.BN
}


/**
 * @description 获取 BusinessProject 账户参数
 * 
 */
interface GetBusinessProjectAccountParams {
  nonceBase: PublicKey,
  projectId: PublicKey
};

const NONCE_VERIFY_PROJECT_SEED = Buffer.from("nonce_verify_project");
const NONCE_VAULT_ACCOUNT_SEED = Buffer.from("nonce_vault_account");
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
   * @description 查找 NonceVault 地址
   * @param base 
   * @returns 
   */
  public findNonceVaultAddress(base: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [NONCE_VAULT_ACCOUNT_SEED, base.toBuffer()],
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
  public findUserBusinessNonceAccountAddress(params: {
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
      nonceProjectAdmin: params.admin ? params.admin : null
    };

    // 构造指令
    const ix = await this.program.methods
      .initializeNonceProject(initializeProjectParams)
      .accounts({
        payer: params.payer,
        nonceProjectBase: params.base
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
  public async getNonceProjectAccountByBasePubkey(basePubkey: PublicKey): Promise<ProgramNonceProjectAccount> {
    const accountPubkey = this.findNonceProjectAddress(basePubkey);
    return await this.program.account.nonceProject.fetch(accountPubkey);
  }
  public async getNonceProjectAccountByNonceProjectPubkey(nonceAccountPubkey: PublicKey): Promise<ProgramNonceProjectAccount> {
    return await this.program.account.nonceProject.fetch(nonceAccountPubkey);
  }


  /**
   * @description 注册 BusinessProject
   * @param params 
   */
  public async registerBusinessProjectAction(params: RegisterBusinessProjectActionParams): Promise<ActionResult> {
    const registerBusinessProjectParams: ProgramRegisterBusinessProjectParams = {
      projectId: params.projectId,
      businessProjectAuthority: params.projectAuthority
    };

    // anchor 0.30.1 BUG: 所有pda账户使用字面量传递时都报错
    const accounts = {
      payer: params.payer,
      registerFeePayer: params.registerFeePayer,
      nonceProjectAdmin: params.nonceAdmin ? params.nonceAdmin : null,
      businessProjectAuthority: params.projectAuthority,
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

  public async getBusinessProjectAccount(params: GetBusinessProjectAccountParams): Promise<ProgramBusinessProjectAccount>;
  public async getBusinessProjectAccount(businessProject: PublicKey): Promise<ProgramBusinessProjectAccount>;

  public async getBusinessProjectAccount(
    paramsOrBusinessProject: GetBusinessProjectAccountParams | PublicKey
  ): Promise<ProgramBusinessProjectAccount> {
    if ((paramsOrBusinessProject as GetBusinessProjectAccountParams).nonceBase !== undefined) {
      const { nonceBase, projectId } = paramsOrBusinessProject as GetBusinessProjectAccountParams;
      return await this.program.account.businessProject.fetch(this.findBusinessProjectAddress({ nonceBase, projectId }));
    } else if (paramsOrBusinessProject instanceof PublicKey) {
      return await this.program.account.businessProject.fetch(paramsOrBusinessProject);
    } else {
      throw new Error("Invalid params");
    }
  }

  /**
   * @description 获取用户业务 Nonce
   * 如果对应的用户业务 nonce 不存在，则返回 0
   * 如果 businessProject 不存在，则抛出异常
   * @param params.userPubkey 用户账户公钥
   * @param params.businessProject 业务工程账户公钥
   */
  public async getUserBusinessNonceValue(params: {
    userPubkey: PublicKey,
    businessProject: PublicKey
  }): Promise<{
    // nonce值
    nonceValue: number
    // nonce账户是否存在
    isExist: boolean
  }> {
    const { userPubkey, businessProject } = params;

    const businessProjectAccountInfo = await this.connection.getAccountInfo(businessProject);
    if (!businessProjectAccountInfo) {
      throw new Error(`businessProject: ${businessProject.toBase58()} not found`);
    }

    const userBusinessNonceAddress = this.findUserBusinessNonceAccountAddress({ businessProject, user: userPubkey });
    const userBusinessNonceAccountInfo = await this.connection.getAccountInfo(userBusinessNonceAddress);

    if (!userBusinessNonceAccountInfo) {
      return {
        nonceValue: 0,
        isExist: false
      };
    }

    // 解析 userBusinessNonce Account Data
    // 注意这个写法！！！ 获取AccountData后， 可以用这种方式进行解码
    const data: ProgramUserBusinessNonceStateAccount =
      this.program.account.userBusinessNonceState.coder.accounts.decode("userBusinessNonceState", userBusinessNonceAccountInfo.data);

    return {
      nonceValue: data.nonceValue,
      isExist: true
    };
  }

  /**
   * @description 初始化用户业务 Nonce State
   * @param params 
   */
  public async initUserBusinessNonceStateAction(params: InitUserBusinessNonceStateActionParams): Promise<ActionResult> {
    const ix = await this.program.methods.initUserBusinessNonce().accounts({
      payer: params.payer,
      nonceUser: params.user,
      businessProject: params.businessProject,
    }).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.userKeypair]
    };

    return await buildActionResult(buildParams);
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

      businessProjectAuthority: businessProjectAccountData.businessProjectAuthority,
      businessProject: params.businessProject,

      userBusinessNonce: this.findUserBusinessNonceAccountAddress({
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

  /**
   * @description 关闭 UserBusinessNonceAccount
   * @param params 
   * @returns 
   */
  public async closeUserBusinessNonceAccountAction(params: CloseUserBusinessNonceActionParams): Promise<ActionResult> {

    const accounts = {
      nonceUser: params.nonceUser,
      userBusinessNonce: params.userBusinessNonceAccountPubkey,
    };

    // 构造指令
    const ix = await this.program.methods
      .closeUserBusinessNoce()
      .accounts(accounts).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.nonceUser,
      signers: [params.nonceUserKeypair]
    };

    return await buildActionResult(buildParams);
  }

  /**
   * @description 领取 nonce 交易费
   * 注意：最多可以从 nonce-project 中领取多少， 需要进行额外的计算，如果超过这个额度，而没有把nonce-project中的余额清空，会导致交易失败
   * @param params 
   * @returns 
   */
  public async claimNonceFeeAction(params: ClaimNonceFeeActionParams): Promise<ActionResult> {
    const claimNonceFeeParams: ProgramClaimNonceFeeParams = {
      amount: params.amount
    };

    // 构造指令
    const ix = await this.program.methods
      .claimNonceFee(claimNonceFeeParams)
      .accounts({
        payer: params.payer,
        receiver: params.receiverPubkey,
        nonceProjectBase: params.nonceProjectBase,
      }).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.nonceProjectBaseKeypair]
    };

    return await buildActionResult(buildParams);
  }


}
