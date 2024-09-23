use anchor_lang::prelude::*;

use anchor_lang::solana_program::{ed25519_program, instruction, program};

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

    verify_sign_use_ed25519_program(sign_data, &params.signature, pk)
}

/// 使用 ed25519-program 验证签名
fn verify_sign_use_ed25519_program(msg: &[u8], signature: &[u8], pk: &[u8]) -> Result<()> {
    let mut ix_data = vec![];

    let public_key_offset: u16 = 2 * 1 + 7 * 2; // size_of<u8> == 1, size_of<u16> == 2
    let signature_offset: u16 = public_key_offset + (pk.len() as u16); // public_key size == 32
    let message_offset: u16 = signature_offset + (signature.len() as u16); // signature size == 64

    ix_data.extend_from_slice(&[1]); // num of signaturs
    ix_data.extend_from_slice(&[0]); // padding

    ix_data.extend_from_slice(signature_offset.to_le_bytes().as_ref()); // signature offset
    ix_data.extend_from_slice(u16::MAX.to_le_bytes().as_ref()); // signature instruction index

    ix_data.extend_from_slice(public_key_offset.to_le_bytes().as_ref()); // public key offset
    ix_data.extend_from_slice(u16::MAX.to_le_bytes().as_ref()); // public key instruction index

    ix_data.extend_from_slice(message_offset.to_le_bytes().as_ref()); // message offset
    ix_data.extend_from_slice(msg.len().to_le_bytes().as_ref()); // message length
    ix_data.extend_from_slice(u16::MAX.to_le_bytes().as_ref()); // message instruction index

    ix_data.extend_from_slice(pk); // public key
    ix_data.extend_from_slice(signature); // signature
    ix_data.extend_from_slice(msg); // message

    let ix_data = ix_data.as_slice();

    let program_id = ed25519_program::id();
    let accounts = vec![];
    let ix = instruction::Instruction::new_with_bytes(program_id, ix_data, accounts);

    let account_infos = vec![];

    program::invoke(&ix, &account_infos)?;

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
    #[account(mut)]
    pub nonce_project: Box<Account<'info, nonce_verify_accounts::NonceProject>>,

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
    pub user_business_nonce: Box<Account<'info, nonce_verify_accounts::UserBusinessNonce>>,

    // 系统程序
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    // nonce 服务程序
    pub nonce_program: Program<'info, NonceVerify>,
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
