use anchor_lang::prelude::*;

#[error_code]
pub enum NonceVerifyErrors {
    #[msg("The project name is too long")]
    ProjectNameTooLong,

    #[msg("run out of nonce project's admin signature")]
    RunOutOfAdminSignature,
}
