mod instructions;
mod constants;
mod errors;

use anchor_lang::prelude::*;

use instructions::*;

declare_id!("4U17W5WH9JJQZK9HcZaD9mYhWehhBSyymAoG6gMYj5CW");

#[program]
pub mod nonce_verify {

    use super::*;

    /// 初始化-nonce-verify
    pub fn initialize_project(
        ctx: Context<InitializeProject>, 
        params: InitializeProjectParams
    ) -> Result<()> {
        instructions::initialize_project(ctx, params)
    }
}
