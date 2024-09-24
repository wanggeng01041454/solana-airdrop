use anchor_lang::prelude::*;

use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::NonceVerifyErrors;

use crate::instructions::init_user_business_nonce::UserBusinessNonceState;
use crate::instructions::initialize_nonce_project::NonceProject;
use crate::instructions::register_business_project::BusinessProject;

/// 验证业务nonce
/// @return 验证通过，则返回最新的 nonce 值
pub fn verify_business_nonce(
    ctx: Context<VerifyBusinessNonceAccounts>,
    params: VerifyBusinessNonceParams,
) -> Result<u32> {
    msg!("verify user's business nonce");

    // 检查是否要收取用户使用费用，配置了则收取
    // 一个需要关注的BUG： 如果用EOA账户收款，如果该账户原本的lamports为0，（由于fee很少），受到fee后，账户的lamports不足以支付rent,会导致本交易失败
    let fee = ctx.accounts.nonce_project.user_fee;
    if fee > 0 {
        msg!(
            "nonce project receive user fee: {}, from {}",
            fee,
            ctx.accounts.user_fee_payer.key()
        );

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user_fee_payer.to_account_info(),
                to: ctx.accounts.nonce_vault_account.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, fee as u64)?;
    }

    // 校验 nonce 值
    let mut cur_nonce_value = ctx.accounts.user_business_nonce.nonce_value;
    if cur_nonce_value != params.nonce_value {
        return Err(NonceVerifyErrors::NonceValueNotMatch.into());
    }
    cur_nonce_value += 1;
    let cur_nonce_value = cur_nonce_value;

    msg!(
        "input nonce value: {}, current nonce value: {}",
        params.nonce_value,
        cur_nonce_value
    );

    ctx.accounts.user_business_nonce.nonce_value = cur_nonce_value;

    Ok(cur_nonce_value)
}

#[derive(Accounts)]
#[instruction(params: VerifyBusinessNonceParams)]
pub struct VerifyBusinessNonceAccounts<'info> {
    /// 创建账户费用-支付账户
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 用户使用费-支付账户
    #[account(mut)]
    pub user_fee_payer: Signer<'info>,

    /// nonce用户, 消耗nonce需要用户签名签名
    pub nonce_user: Signer<'info>,

    /// user-business-nonce账户中的nonce发生变化
    #[account(
        mut,
        seeds = [
            USER_BUSINESS_NONCE_SEED,
            business_project.key().as_ref(),
            nonce_user.key().as_ref()
        ],
        bump,
    )]
    pub user_business_nonce: Box<Account<'info, UserBusinessNonceState>>,

    /// 需要 project-authority 的签名
    pub business_project_authority: Signer<'info>,

    /// business-project账户
    #[account(
        has_one = nonce_project,
        has_one = business_project_authority,
        seeds = [
            BUSINESS_PROJECT_SEED,
            nonce_project.key().as_ref(),
            business_project.business_project_id.as_ref()
        ],
        bump,
    )]
    pub business_project: Box<Account<'info, BusinessProject>>,

    /// nonce Project账户, 验证 business nonce, 读取费用信息, 并收取费用
    #[account(
        seeds = [
            NONCE_PROJECT_SEED,
            nonce_project.nonce_project_base.key().as_ref()
            ],
        bump
    )]
    pub nonce_project: Box<Account<'info, NonceProject>>,

    /// 使用该账户收款
    #[account(
            mut,
            seeds = [
                NONCE_VAULT_ACCOUNT_SEED,
                nonce_project.nonce_project_base.key().as_ref()
            ],
            bump,
        )]
    pub nonce_vault_account: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct VerifyBusinessNonceParams {
    pub nonce_value: u32,
}
