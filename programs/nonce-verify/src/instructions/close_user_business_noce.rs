use anchor_lang::prelude::*;

use crate::instructions::UserBusinessNonceState;

pub fn close_user_business_noce(ctx: Context<CloseUserBusinessNonceAccounts>) -> Result<()> {
    msg!("close user business nonce project");

    // 将账户余额转移到接收者账户
    let lamports = ctx
        .accounts
        .user_business_nonce
        .to_account_info()
        .lamports();

    **ctx
        .accounts
        .nonce_user
        .to_account_info()
        .lamports
        .borrow_mut() += lamports;

    **ctx
        .accounts
        .user_business_nonce
        .to_account_info()
        .lamports
        .borrow_mut() = 0;

    // 将账户标记为已关闭
    ctx.accounts
        .user_business_nonce
        .close(ctx.accounts.nonce_user.to_account_info())?;

    Ok(())
}

#[derive(Accounts)]
pub struct CloseUserBusinessNonceAccounts<'info> {
    /// 需要 用户 签名
    /// 用户自己支付手续费，自己接收关闭后的资金
    #[account(mut)]
    pub nonce_user: Signer<'info>,

    /// 被关闭的 airdrop 项目
    #[account(
        mut,
        has_one = nonce_user,
    )]
    pub user_business_nonce: Box<Account<'info, UserBusinessNonceState>>,

    pub system_program: Program<'info, System>,
}
