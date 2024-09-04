use anchor_lang::prelude::*;

declare_id!("GMznVrvA9P4WfBzJPWq92BWmsBMQUo6pb8B7CMSvgX9n");

#[program]
pub mod solana_airdrop {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    // claim 接口

    // 权限设置接口
}

#[derive(Accounts)]
pub struct Initialize {}
