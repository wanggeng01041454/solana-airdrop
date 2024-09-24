use anchor_lang::prelude::*;

use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked, ID as SYSVAR_IX_ID,
};

use anchor_spl::token;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::outer_program::nonce_verify::{
    accounts as nonce_verify_accounts, cpi as nonce_verify_cpi, program::NonceVerify,
    types as nonce_verify_types,
};

use crate::constants::*;
use crate::errors::*;
use crate::instructions::AirdropProject;

pub fn claim_ft(ctx: Context<ClaimFtAccounts>, params: ClaimFtParams) -> Result<()> {
    msg!("claim ft-token");

    // 1. 校验 nonce
    verify_nonce(&ctx, &params)?;

    // 2. 构造待签名数据，并校验签名
    verify_sign(&ctx, &params)?;

    // 3. 发放代币
    do_mint_ft(&ctx, &params)?;

    Ok(())
}

/// 校验 nonce 实现
fn verify_nonce(ctx: &Context<ClaimFtAccounts>, params: &ClaimFtParams) -> Result<()> {
    msg!("verify nonce");

    // let nonce_value = ctx.accounts.user_business_nonce.as_ref().nonce_value;
    // msg!("nonce_value: {}, input_nonce: {}", nonce_value, params.nonce);

    // 获取 pda 账户对应的seeds, 以及进行 cpi 调用，参看：https://github.com/coral-xyz/anchor/blob/v0.30.1/docs/src/pages/docs/pdas.md
    // 取出 pda 账户对应的 bump
    let business_project_authority_bump = ctx.bumps.business_project_authority;
    let airdrop_project_pubkey = ctx.accounts.airdrop_project.key();
    let business_project_pubkey = ctx.accounts.business_project.key();
    // 将 pda 账户的 bump 与 seed 组合成 seeds
    let business_project_authority_seeds = &[
        AIRDROP_NONCE_VERIFY_BUSINESS_PROJECT_SEED,
        airdrop_project_pubkey.as_ref(),
        business_project_pubkey.as_ref(),
        &[business_project_authority_bump],
    ];

    let cpi_singer = &[&business_project_authority_seeds[..]];

    let nonce_verify_program = ctx.accounts.nonce_program.to_account_info();
    // 按 nonce_verify_cpi::verify_business_nonce 的声明顺序
    let nonce_verify_accounts = nonce_verify_cpi::accounts::VerifyBusinessNonce {
        payer: ctx.accounts.payer.to_account_info(),
        user_fee_payer: ctx.accounts.nonce_fee_payer.to_account_info(),
        nonce_user: ctx.accounts.claim_user.to_account_info(),
        user_business_nonce: ctx.accounts.user_business_nonce.to_account_info(),
        business_project_authority: ctx.accounts.business_project_authority.to_account_info(), // business_project_authority 是本地的 pda account
        business_project: ctx.accounts.business_project.to_account_info(),
        nonce_project: ctx.accounts.nonce_project.to_account_info(),
        nonce_vault_account: ctx.accounts.nonce_vault_account.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let nonce_verify_ctx =
        CpiContext::new_with_signer(nonce_verify_program, nonce_verify_accounts, cpi_singer);

    let nonce_verify_params = nonce_verify_types::VerifyBusinessNonceParams {
        nonce_value: params.nonce,
    };

    // 校验 nonce
    let _ = nonce_verify_cpi::verify_business_nonce(nonce_verify_ctx, nonce_verify_params)?;

    Ok(())
}

/// 构造待签名数据，并验证签名
/// 签名数据格式：[nonce, amount, mint_address, user_address, airdrop_project_address, nonce_business_project_address]
/// 所有元素按 &[u8] 进行拼接， 拼接成为一个 &[u8]
/// 整数转换为 &[u8] 可以使用 to_le_bytes() 方法（按小端方式转换为&[u8]）
fn verify_sign(ctx: &Context<ClaimFtAccounts>, params: &ClaimFtParams) -> Result<()> {
    msg!("verify signature");
    // 构造待签名数据
    let mut sign_data = vec![];
    sign_data.extend_from_slice(&params.nonce.to_le_bytes());
    sign_data.extend_from_slice(&params.amount.to_le_bytes());
    sign_data.extend_from_slice(ctx.accounts.mint.key().as_ref());
    sign_data.extend_from_slice(ctx.accounts.claim_user.key().as_ref());
    sign_data.extend_from_slice(ctx.accounts.airdrop_project.key().as_ref());
    sign_data.extend_from_slice(ctx.accounts.business_project.key().as_ref());

    // 验证签名
    let sign_data = sign_data.as_slice();

    let pk = ctx
        .accounts
        .airdrop_project
        .as_ref()
        .airdrop_project_admin
        .as_ref();

    verify_sign_data_used_by_ed25519_program(ctx, sign_data, &params.signature, pk)
}

/// 使用 ed25519-program 验证签名
/// 实际上，ed25519-program 在前一个指令中被调用，此处验证： 调用 ed25519-program 时，指令参数是否和预期的一致， 一致则认为签名验证通过。
fn verify_sign_data_used_by_ed25519_program(
    ctx: &Context<ClaimFtAccounts>,
    msg: &[u8],
    signature: &[u8],
    pk: &[u8],
) -> Result<()> {
    msg!("verify sign data used by ed25519-program");
    // 保证本指令的前一个指令是 ed25519-program 的调用
    let ix_sysvar_account_info = ctx.accounts.ix_sysvar.to_account_info();
    let current_index = load_current_index_checked(&ix_sysvar_account_info)?;
    if current_index == 0 {
        return Err(AirdropErrors::MissingEd25519Instruction.into());
    }
    let ed25519_instruction =
        load_instruction_at_checked((current_index - 1) as usize, &ix_sysvar_account_info)?;

    // The program id we expect, // With no context accounts, // And data of this size
    if ed25519_instruction.program_id != ed25519_program::ID
        || ed25519_instruction.accounts.len() != 0
        || ed25519_instruction.data.len() != (16 + 64 + 32 + msg.len())
    {
        return Err(AirdropErrors::SigVerificationFailed.into()); // Otherwise, we can already throw err
    }

    // 解析指令数据，要求它和预期的一致
    let ix_data = ed25519_instruction.data;

    let num_signatures = &[ix_data[0]]; // Byte  0
    let padding = &[ix_data[1]]; // Byte  1
    let signature_offset = &ix_data[2..=3]; // Bytes 2,3
    let signature_instruction_index = &ix_data[4..=5]; // Bytes 4,5
    let public_key_offset = &ix_data[6..=7]; // Bytes 6,7
    let public_key_instruction_index = &ix_data[8..=9]; // Bytes 8,9
    let message_data_offset = &ix_data[10..=11]; // Bytes 10,11
    let message_data_size = &ix_data[12..=13]; // Bytes 12,13
    let message_instruction_index = &ix_data[14..=15]; // Bytes 14,15

    let data_pubkey = &ix_data[16..16 + 32]; // Bytes 16..16+32
    let data_sig = &ix_data[48..48 + 64]; // Bytes 48..48+64
    let data_msg = &ix_data[112..]; // Bytes 112..end

    // Expected values
    let exp_public_key_offset: u16 = 16; // 2*u8 + 7*u16
    let exp_signature_offset: u16 = exp_public_key_offset + pk.len() as u16;
    let exp_message_data_offset: u16 = exp_signature_offset + signature.len() as u16;
    let exp_num_signatures: u8 = 1;
    let exp_message_data_size: u16 = msg.len().try_into().unwrap();

    // Header and Arg Checks

    // Header
    if num_signatures != &exp_num_signatures.to_le_bytes()
        || padding != &[0]
        || signature_offset != &exp_signature_offset.to_le_bytes()
        || signature_instruction_index != &u16::MAX.to_le_bytes()
        || public_key_offset != &exp_public_key_offset.to_le_bytes()
        || public_key_instruction_index != &u16::MAX.to_le_bytes()
        || message_data_offset != &exp_message_data_offset.to_le_bytes()
        || message_data_size != &exp_message_data_size.to_le_bytes()
        || message_instruction_index != &u16::MAX.to_le_bytes()
    {
        return Err(AirdropErrors::SigVerificationFailed.into());
    }

    // Arguments
    if data_pubkey != pk || data_msg != msg || data_sig != signature {
        return Err(AirdropErrors::SigVerificationFailed.into());
    }

    Ok(())
}

/// 发放代币
fn do_mint_ft(ctx: &Context<ClaimFtAccounts>, params: &ClaimFtParams) -> Result<()> {
    msg!("mint ft-token");

    let mint_authority_bump = ctx.bumps.mint_authority;
    let airdrop_project_pubkey = ctx.accounts.airdrop_project.key();
    let mint_pubkey = ctx.accounts.mint.key();
    let mint_authority_seeds = &[
        AIRDROP_MINT_AUTHORITY_SEED,
        airdrop_project_pubkey.as_ref(),
        mint_pubkey.as_ref(),
        &[mint_authority_bump],
    ];

    let cpi_signer = &[&mint_authority_seeds[..]];

    let mint_to_accounts = token::MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };

    let mint_to_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        mint_to_accounts,
        cpi_signer,
    );

    token::mint_to(mint_to_ctx, params.amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimFtAccounts<'info> {
    // 交易 gas 费用支付者
    #[account(mut)]
    pub payer: Signer<'info>,

    // 使用nonce服务时，支付费用的账户
    #[account(mut)]
    pub nonce_fee_payer: Signer<'info>,

    // 来进行claim 的 user 账户
    pub claim_user: Signer<'info>,

    // 创建 token 账户时，支付费用的payer
    #[account(mut)]
    pub space_fee_payer: Signer<'info>,

    // 关联的 airdrop 项目账户
    pub airdrop_project: Box<Account<'info, AirdropProject>>,

    // mint 账户， 用于申领的代币地址， mintAccount
    // fixme: mint账户必须被标记为mut, 否则会报错, 因为mint时，修改了mint账户的supply
    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    // mint 账户的权限管理账户, 为用户铸造时，需要该账户的签名
    ///CHECK: 该账户只是用来控制权限，并不实际存在
    #[account(
        seeds = [
            AIRDROP_MINT_AUTHORITY_SEED,
            airdrop_project.key().as_ref(),
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    // user 的 token 账户
    #[account(
        init_if_needed,
        payer = space_fee_payer,
        associated_token::mint = mint,
        associated_token::authority = claim_user,
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    // nonce project 账户
    pub nonce_project: Box<Account<'info, nonce_verify_accounts::NonceProject>>,

    #[account(mut)]
    pub nonce_vault_account: SystemAccount<'info>,

    // business project 账户
    #[account(
        has_one = business_project_authority,
        has_one = nonce_project,
    )]
    pub business_project: Box<Account<'info, nonce_verify_accounts::BusinessProject>>,

    // business project authority 账户
    ///CHECK: 该账户只是用来控制权限，并不实际存在
    #[account(
        seeds = [
            AIRDROP_NONCE_VERIFY_BUSINESS_PROJECT_SEED,
            airdrop_project.key().as_ref(),
            business_project.key().as_ref()
        ],
        bump,
    )]
    pub business_project_authority: AccountInfo<'info>,

    // user business nonce 账户
    // fixme: user_business_nonce账户必须被标记为mut, 因为nonce验证时，修改了nonce值
    #[account(mut)]
    pub user_business_nonce: Box<Account<'info, nonce_verify_accounts::UserBusinessNonceState>>,

    // 系统程序
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    // nonce 服务程序
    pub nonce_program: Program<'info, NonceVerify>,

    /// CHECK: The address check is needed because otherwise
    /// the supplied Sysvar could be anything else.
    /// The Instruction Sysvar has not been implemented
    /// in the Anchor framework yet, so this is the safe approach.
    #[account(address = SYSVAR_IX_ID)]
    pub ix_sysvar: AccountInfo<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct ClaimFtParams {
    // 申领的代币数量
    pub amount: u64,

    // nonce 服务的 nonce 值
    pub nonce: u32,

    // 签名数据
    pub signature: Vec<u8>,
}
