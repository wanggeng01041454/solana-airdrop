use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;

pub fn initialize_nonce_project(
    ctx: Context<InitializeNonceProjectAccounts>,
    params: InitializeNonceProjectParams,
) -> Result<()> {
    msg!("initialize nonce project");

    ctx.accounts.nonce_project.set_inner(NonceProject {
        nonce_project_admin: params.nonce_project_admin,
        nonce_project_base: *ctx.accounts.nonce_project_base.key,
        nonce_vault_account: *ctx.accounts.nonce_vault_account.key,
        business_fee: params.business_fee,
        user_fee: params.user_fee,
    });

    // 获取租金豁免金额
    let rent = Rent::get()?;
    let minimum_balance = rent.minimum_balance(0);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.nonce_vault_account.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, minimum_balance)?;

    Ok(())
}

#[account]
pub struct NonceProject {
    /// 管理员账户
    /// 如果存在，则每次注册新的业务时，需要管理员签名
    pub nonce_project_admin: Option<Pubkey>,

    /// base Account
    pub nonce_project_base: Pubkey,

    /// 专门用来收钱的账户
    /// fixme: 从 nonce_project(包含数据) 转移sol时，有无法解决的问题，所以设计该账户，专门用来收费
    pub nonce_vault_account: Pubkey,

    /// 业务费用
    /// 每次注册新业务时需要支付的费用, lamports
    pub business_fee: u32,

    /// 每次使用时需要支付的费用, lamports
    pub user_fee: u32,
}

impl NonceProject {
    const LEN: usize = 8 + (1 + 32) + 32 + 32 + 4 + 4;
}

#[derive(Accounts)]
pub struct InitializeNonceProjectAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub nonce_project_base: Signer<'info>,

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

    #[account(
        mut,
        seeds = [
            NONCE_VAULT_ACCOUNT_SEED,
            nonce_project_base.key().as_ref()
        ],
        bump,
    )]
    pub nonce_vault_account: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct InitializeNonceProjectParams {
    /// 业务费用
    /// 每次注册新业务时需要支付的费用
    pub business_fee: u32,

    /// 每次使用时需要支付的费用
    pub user_fee: u32,

    /// 管理员账户, 可选账户
    /// 如果存在，需要在注册时签名
    pub nonce_project_admin: Option<Pubkey>,
}
