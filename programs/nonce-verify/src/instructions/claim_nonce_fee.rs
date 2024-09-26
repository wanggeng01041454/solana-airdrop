use anchor_lang::prelude::*;

// 注意！这里要用CpiContext 的transfer方法, 不能使用 anchor_lang::solana_program::system_program::transfer
use anchor_lang::system_program;

use crate::constants::*;
use crate::instructions::initialize_nonce_project::NonceProject;

pub fn claim_nonce_fee(
    ctx: Context<ClaimNonceFeeAccounts>,
    params: ClaimNonceFeeParams,
) -> Result<()> {
    msg!("claim fee from nonce project, amount: {}", params.amount);

    let vault_account_bump = ctx.bumps.nonce_vault_account;
    let nonce_project_id = ctx.accounts.nonce_project.project_id.key();

    let vault_account_seeds = &[
        NONCE_VAULT_ACCOUNT_SEED,
        nonce_project_id.as_ref(),
        &[vault_account_bump],
    ];

    let cpi_signer = &[&vault_account_seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.nonce_vault_account.to_account_info(),
            to: ctx.accounts.receiver.to_account_info(),
        },
        cpi_signer,
    );
    system_program::transfer(cpi_ctx, params.amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimNonceFeeAccounts<'info> {
    /// 创建账户费用-支付账户
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 接收账户
    /// CHECK: 仅接收 fee 的账户
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    /// 提取资金时，需要admin账户签名
    pub nonce_project_admin: Signer<'info>,

    /// nonce Project账户, 
    #[account(
        has_one = nonce_project_admin,
    )]
    pub nonce_project: Box<Account<'info, NonceProject>>,

    /// 从该收款账户中转走钱
    #[account(
        mut,
        seeds = [
            NONCE_VAULT_ACCOUNT_SEED,
            nonce_project.project_id.key().as_ref()
        ],
        bump,
    )]
    pub nonce_vault_account: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct ClaimNonceFeeParams {
    /// 提取的资金量
    pub amount: u64,
}
