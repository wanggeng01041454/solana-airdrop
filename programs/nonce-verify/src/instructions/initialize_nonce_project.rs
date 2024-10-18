use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;

pub fn initialize_nonce_project(
    ctx: Context<InitializeNonceProjectAccounts>,
    params: InitializeNonceProjectParams,
) -> Result<()> {
    msg!("initialize nonce project");

    ctx.accounts.nonce_project.set_inner(NonceProject {
        project_id: params.project_id.key(),
        nonce_project_admin: ctx.accounts.nonce_project_admin.key(),
        nonce_vault_account: *ctx.accounts.nonce_vault_account.key,
        register_business_need_verify: params.register_business_need_verify,
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
    /// nonce project 的 id
    pub project_id: Pubkey,

    /// 管理员账户
    /// 则每次注册新的业务时，需要管理员签名
    pub nonce_project_admin: Pubkey,

    /// 专门用来收钱的pda账户, 没有account-data
    /// fixme: 从 nonce_project(包含数据) 转移sol时，有无法解决的问题，所以设计该账户，专门用来收费
    pub nonce_vault_account: Pubkey,

    /// 注册新的 business-project 时，是否需要管理员签名授权
    pub register_business_need_verify: bool,

    /// 业务费用
    /// 每次注册新业务时需要支付的费用, lamports
    pub business_fee: u32,

    /// 每次使用时需要支付的费用, lamports
    pub user_fee: u32,
}

impl NonceProject {
    const LEN: usize = 8 + 32 + 32 + 32 + 1 + 4 + 4;
}

#[derive(Accounts)]
#[instruction(params: InitializeNonceProjectParams)]
pub struct InitializeNonceProjectAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 需要 project-admin 签名，才可以创建账户
    pub nonce_project_admin: Signer<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [
            NONCE_PROJECT_SEED,
            params.project_id.key().as_ref()
        ],
        bump,
        space = NonceProject::LEN
    )]
    pub nonce_project: Account<'info, NonceProject>,

    #[account(
        mut,
        seeds = [
            NONCE_VAULT_ACCOUNT_SEED,
            params.project_id.key().as_ref()
        ],
        bump,
    )]
    pub nonce_vault_account: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct InitializeNonceProjectParams {
    /// project-id, 用于标识 nonce-project
    pub project_id: Pubkey,

    /// 注册新的 business-project 时，是否需要管理员签名授权
    pub register_business_need_verify: bool,

    /// 业务费用
    /// 每次注册新业务时需要支付的费用
    pub business_fee: u32,

    /// 每次使用时需要支付的费用
    pub user_fee: u32,
}
