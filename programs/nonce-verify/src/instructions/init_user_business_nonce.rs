use anchor_lang::prelude::*;

use crate::constants::*;

use crate::instructions::register_business_project::BusinessProject;


/// 初始化用户的业务nonce, 创建对应的账户
/// 创建账户时，只需要用户签名即可， 不需要 business_project-authority 的授权
pub fn init_user_business_nonce(
    ctx: Context<InitUserBusinessNonceAccounts>
) -> Result<()> {
    msg!("init user's business nonce account");

    ctx.accounts.user_business_nonce.set_inner(UserBusinessNonceState {
      nonce_value: 0,
      business_project: ctx.accounts.business_project.key(),
      nonce_user: *ctx.accounts.nonce_user.key,
  });

    Ok(())
}


/// 用户属于某个业务工程的nonce
#[account]
pub struct UserBusinessNonceState {
    /// 用户的nonce值
    pub nonce_value: u32,

    /// 关联的业务工程
    pub business_project: Pubkey,

    /// 用户地址, 表示关联的用户账户
    pub nonce_user: Pubkey,
}

impl UserBusinessNonceState {
    const LEN: usize = 8 + 4 + 32 + 32;
}

#[derive(Accounts)]
pub struct InitUserBusinessNonceAccounts<'info> {
    /// 创建账户费用-支付账户
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 用户自身签名
    #[account(mut)]
    pub nonce_user: Signer<'info>,

    /// 用户自行支付 business 的创建费用，该费用可以被用户回收
    #[account(
        init,
        payer = nonce_user,
        seeds = [
            USER_BUSINESS_NONCE_SEED,
            business_project.key().as_ref(),
            nonce_user.key().as_ref()
        ],
        bump,
        space = UserBusinessNonceState::LEN
    )]
    pub user_business_nonce: Account<'info, UserBusinessNonceState>,

    /// business-project账户
    pub business_project: Box<Account<'info, BusinessProject>>,

    pub system_program: Program<'info, System>,
}


