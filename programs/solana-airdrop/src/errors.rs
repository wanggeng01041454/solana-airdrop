use anchor_lang::prelude::*;


#[error_code]
pub enum AirdropErrors {
    #[msg("The project name is too long")]
    ProjectNameTooLong,

    #[msg("run out of nonce project's admin signature")]
    RunOutOfAdminSignature,

    #[msg("nonce value not match")]
    NonceValueNotMatch,
}