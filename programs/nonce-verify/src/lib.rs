mod constants;
mod errors;
mod instructions;

use anchor_lang::prelude::*;

use instructions::*;

declare_id!("4U17W5WH9JJQZK9HcZaD9mYhWehhBSyymAoG6gMYj5CW");

#[program]
pub mod nonce_verify {

    use super::*;

    /// 初始化-nonce-verify
    /// 初始化一个新的nonce-verify项目
    pub fn initialize_nonce_project(
        ctx: Context<InitializeNonceProjectAccounts>,
        params: InitializeNonceProjectParams,
    ) -> Result<()> {
        instructions::initialize_nonce_project(ctx, params)
    }

    /// 注册一个业务工程
    pub fn register_business_project(
        ctx: Context<RegisterBusinessProjectAccounts>,
        params: RegisterBusinessProjectParams,
    ) -> Result<()> {
        instructions::register_business_project(ctx, params)
    }

    /// 初始化用户的业务nonce
    pub fn init_user_business_nonce(
        ctx: Context<InitUserBusinessNonceAccounts>,
    ) -> Result<()> {
        instructions::init_user_business_nonce(ctx)
    }

    /// 验证业务nonce
    pub fn verify_business_nonce(
        ctx: Context<VerifyBusinessNonceAccounts>,
        params: VerifyBusinessNonceParams,
    ) -> Result<u32> {
        instructions::verify_business_nonce(ctx, params)
    }

    //todo: 从 nonce-project 中取走费用
    //todo: 变更 business-project 的authority

}
