use anchor_lang::prelude::*;

use anchor_spl::token;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use crate::constants::*;
use crate::instructions::DdaAirdropProject;

/// 转移 mint-account 的 mint-authority
/// 为了进行airdrop的claim, mint-account的mint-authority需要设置为airdrop的pda地址
/// 在空投完成后，需要能够转移走
pub fn transfer_dda_mint_authority(ctx: Context<TransferMintAuthAccounts>) -> Result<()> {
    msg!("transfer direct-distribute-airdrop mint authority");

    // 旧的 mint-authority
    let mint_authority_bump = ctx.bumps.mint_authority;
    let dda_airdrop_project_pubkey = ctx.accounts.dda_airdrop_project.key();
    let mint_pubkey = ctx.accounts.mint.key();
    let mint_authority_seeds = &[
        DIRECT_DISTRIBUTE_AIRDROP_MINT_AUTHORITY_SEED,
        dda_airdrop_project_pubkey.as_ref(),
        mint_pubkey.as_ref(),
        &[mint_authority_bump],
    ];

    let cpi_signer = &[&mint_authority_seeds[..]];

    let set_auth_accounts = token::SetAuthority {
        account_or_mint: ctx.accounts.mint.to_account_info(),
        current_authority: ctx.accounts.mint_authority.to_account_info(),
    };

    let set_auth_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        set_auth_accounts,
        cpi_signer,
    );

    // 为 mint 账户设置新的 mint authority
    token::set_authority(
        set_auth_ctx,
        AuthorityType::MintTokens,
        Some(ctx.accounts.new_mint_authority.key.clone()),
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct TransferMintAuthAccounts<'info> {
    // 交易 gas 费用支付者
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 需要 airdrop_admin 签名
    pub dda_airdrop_admin: Signer<'info>,

    /// 关联的 airdrop 项目账户
    #[account(
        has_one = dda_airdrop_admin,
    )]
    pub dda_airdrop_project: Box<Account<'info, DdaAirdropProject>>,

    /// mint 账户
    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    // mint 账户的权限管理账户, 为用户铸造时，需要该账户的签名
    /// CHECK: 该账户只是用来控制权限，并不实际存在
    #[account(
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_MINT_AUTHORITY_SEED,
            dda_airdrop_project.key().as_ref(),
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    /// 新的 mint authority
    /// CHECK: 这个账户可以放这里，也可以放参数中
    pub new_mint_authority: AccountInfo<'info>,

    // 系统程序
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
