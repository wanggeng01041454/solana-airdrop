use anchor_lang::prelude::*;

// 注意！这里要用CpiContext 的transfer方法, 不能使用 anchor_lang::solana_program::system_program::transfer
use anchor_lang::system_program;

use crate::constants::*;
use crate::instructions::SingletonManageProject;

/// @description 从 singleton manage project 中提取费用
pub fn claim_fee(ctx: Context<ClaimFeeAccounts>, params: ClaimFeeParams) -> Result<()> {
    msg!(
        "claim fee from singleton manage project, amount: {}",
        params.amount
    );

    let fee_receiver_bump = ctx.bumps.fee_receiver;

    let fee_receiver_account_seeds = &[
        DIRECT_DISTRIBUTE_AIRDROP_FEE_RECEIVER_SEED,
        &[fee_receiver_bump],
    ];

    let cpi_signer = &[&fee_receiver_account_seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.fee_receiver.to_account_info(),
            to: ctx.accounts.receiver.to_account_info(),
        },
        cpi_signer,
    );
    system_program::transfer(cpi_ctx, params.amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimFeeAccounts<'info> {
    /// 支付账户
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 接收账户
    /// CHECK: 仅接收 fee 的账户
    #[account(mut)]
    pub receiver: SystemAccount<'info>,

    /// 提取资金时，需要 manage_admin 签名
    pub manage_admin: Signer<'info>,

    // singlton_manage_project 账户
    #[account(
        has_one = manage_admin,
        has_one = fee_receiver,
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_MANAGER_SEED
        ],
        bump,
    )]
    pub singlton_manage_project: Box<Account<'info, SingletonManageProject>>,

    /// 从该收款账户中转走钱
    #[account(
        mut,
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_FEE_RECEIVER_SEED,
        ],
        bump
    )]
    pub fee_receiver: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct ClaimFeeParams {
    /// 提取的资金量
    pub amount: u64,
}
