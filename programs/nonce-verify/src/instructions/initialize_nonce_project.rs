use anchor_lang::prelude::*;

use crate::constants::NONCE_PROJECT_SEED;

pub fn initialize_nonce_project(ctx: Context<InitializeNonceProjectAccounts>, params: InitializeNonceProjectParams) -> Result<()> {
    msg!("initialize nonce project");

    ctx.accounts.nonce_project.set_inner(NonceProject {
        nonce_project_admin: ctx.accounts.nonce_project_admin.as_ref().map(|a| *a.key),
        nonce_project_base: *ctx.accounts.nonce_project_base.key,
        business_fee: params.business_fee,
        user_fee: params.user_fee,
    });

    Ok(())
}

#[account]
pub struct NonceProject {
    /// 管理员账户
    /// 如果存在，则每次注册新的业务时，需要管理员签名
    pub nonce_project_admin: Option<Pubkey>,

    /// base Account
    pub nonce_project_base: Pubkey,

    /// 业务费用
    /// 每次注册新业务时需要支付的费用, lamports
    pub business_fee: u32,

    /// 每次使用时需要支付的费用, lamports
    pub user_fee: u32,
}

impl NonceProject {
    const LEN: usize = 8 + (1+32) + 32 + 4 + 4;
}

#[derive(Accounts)]
pub struct InitializeNonceProjectAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub nonce_project_base: Signer<'info>,

    /// 管理员账户, 可选账户
    /// CHECK: 如果存在，需要在注册时签名
    pub nonce_project_admin: Option<UncheckedAccount<'info>>,

    #[account(
        init, 
        payer = payer, 
        seeds = [
            NONCE_PROJECT_SEED, 
            nonce_project_base.key().as_ref()
        ],
        bump,
        space = NonceProject::LEN
    )]
    pub nonce_project: Account<'info, NonceProject>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct InitializeNonceProjectParams {
    /// 业务费用
    /// 每次注册新业务时需要支付的费用
    pub business_fee: u32,

    /// 每次使用时需要支付的费用
    pub user_fee: u32,
}
