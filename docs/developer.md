# 开发过程踩坑记录

## 1.关于使用 Ed25519 验签合约的说明：

ed25519验证签合约 不能在其他合约中调用。只能在最顶层调用。
因此，使用ed25519验签时，正确的做法是：

1. 在最顶层合约的N个指令中调用ed25519验签合约， 并传入 msg, sig, pubkey, 由 ed25519合约进行验证；
2. 在第N+1个指令中检查 ed25519 的 msg, sig, pubkey 是否和预期一致，如果一致，则认为验签成功。
   `claim_ft`指令就是采用了这种方式。

实现中的注意细节：

1. 需要采用 `sysvar::instructions` 中的方法，获取当前指令的 index,以及判断前一个指令是否是 ed25519 验签指令。
   
   ```rust
   use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked, ID as SYSVAR_IX_ID,
   };
   ```

//...

    // 保证本指令的前一个指令是 ed25519-program 的调用
    let ix_sysvar_account_info = ctx.accounts.ix_sysvar.to_account_info();
    let current_index = load_current_index_checked(&ix_sysvar_account_info)?;
    if current_index == 0 {
        return Err(AirdropErrors::MissingEd25519Instruction.into());
    }
    let ed25519_instruction =
        load_instruction_at_checked((current_index - 1) as usize, &ix_sysvar_account_info)?;
    
    // The program id we expect, // With no context accounts, // And data of this size
    if ed25519_instruction.program_id != ed25519_program::ID
        || ed25519_instruction.accounts.len() != 0
        || ed25519_instruction.data.len() != (16 + 64 + 32 + msg.len())
    {
        return Err(AirdropErrors::SigVerificationFailed.into()); // Otherwise, we can already throw err
    }

```
2. 需要将验证数据（或者可以合并出验证数据的信息）、签名、公钥传入本指令， 在本指令中对比这些数据是否和 ed25519 验签指令的数据匹配
```rust
// 本例中，sign_data在本指令中被合并出来
    // 构造待签名数据
    let mut sign_data = vec![];
    sign_data.extend_from_slice(&params.nonce.to_le_bytes());
    sign_data.extend_from_slice(&params.amount.to_le_bytes());
    sign_data.extend_from_slice(ctx.accounts.mint.key().as_ref());
    sign_data.extend_from_slice(ctx.accounts.claim_user.key().as_ref());
    sign_data.extend_from_slice(ctx.accounts.airdrop_project.key().as_ref());
    sign_data.extend_from_slice(ctx.accounts.business_project.key().as_ref());

    // 验证签名
    let sign_data = sign_data.as_slice();

// 比对数据是否和 ed25519 的指令数据一致
    // 解析指令数据，要求它和预期的一致
    let ix_data = ed25519_instruction.data;

    let num_signatures = &[ix_data[0]]; // Byte  0
    let padding = &[ix_data[1]]; // Byte  1
    let signature_offset = &ix_data[2..=3]; // Bytes 2,3
    let signature_instruction_index = &ix_data[4..=5]; // Bytes 4,5
    let public_key_offset = &ix_data[6..=7]; // Bytes 6,7
    let public_key_instruction_index = &ix_data[8..=9]; // Bytes 8,9
    let message_data_offset = &ix_data[10..=11]; // Bytes 10,11
    let message_data_size = &ix_data[12..=13]; // Bytes 12,13
    let message_instruction_index = &ix_data[14..=15]; // Bytes 14,15

    let data_pubkey = &ix_data[16..16 + 32]; // Bytes 16..16+32
    let data_sig = &ix_data[48..48 + 64]; // Bytes 48..48+64
    let data_msg = &ix_data[112..]; // Bytes 112..end

    // Expected values
    let exp_public_key_offset: u16 = 16; // 2*u8 + 7*u16
    let exp_signature_offset: u16 = exp_public_key_offset + pk.len() as u16;
    let exp_message_data_offset: u16 = exp_signature_offset + signature.len() as u16;
    let exp_num_signatures: u8 = 1;
    let exp_message_data_size: u16 = msg.len().try_into().unwrap();

    // Header and Arg Checks

    // Header
    if num_signatures != &exp_num_signatures.to_le_bytes()
        || padding != &[0]
        || signature_offset != &exp_signature_offset.to_le_bytes()
        || signature_instruction_index != &u16::MAX.to_le_bytes()
        || public_key_offset != &exp_public_key_offset.to_le_bytes()
        || public_key_instruction_index != &u16::MAX.to_le_bytes()
        || message_data_offset != &exp_message_data_offset.to_le_bytes()
        || message_data_size != &exp_message_data_size.to_le_bytes()
        || message_instruction_index != &u16::MAX.to_le_bytes()
    {
        return Err(AirdropErrors::SigVerificationFailed.into());
    }

    // Arguments
    if data_pubkey != pk || data_msg != msg || data_sig != signature {
        return Err(AirdropErrors::SigVerificationFailed.into());
    }
```

## 2.在合约中引用MintAccount

如果要拥有MintAccount的MintAuthority权限，要为其他人Mint代币，则一定要将 MintAccount 标记为 mut.
因为：Mint代币的过程，会变更supply，而supply是MintAccount的一个字段，因此需要mut权限。

```rust
    // mint 账户， 用于申领的代币地址， mintAccount
    // fixme: mint账户必须被标记为mut, 否则会报错, 因为mint时，修改了mint账户的supply
    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,
```

## 3.两个使用anchor实现的合约， A 合约调用了 B 合约，且 A 合约中要求 B 合约的账户是 init_if_needed(需要时创建)

init_if_needed 需要在A合约中进行比较精细的底层控制，且需要B合约配合（实现初始化账户指令），
第一点在anchor框架下实现起来比骄傲麻烦（不确定能否实现）。
但是，我们有一个简单的替代方案。

setp1. 在B合约中增加一个创建指令(init)
setp2. 在A合约的相应 X 指令中，直接认为B合约的账户已经存在
setp3. 在调用A合约的X指令签，在线下盘但B合约的账户是否存在，如果不存在，则在交易中增加一个创建账户指令，放在调用A合约的X指令之前。

## 4.有 AccountData 的账户如果收取了 sol, 除非关闭账户，否则无法（暂时找不到）将sol转移出来。

所以，如果有一个收款pda账户，则要保证该账户没有AccountData, 像一个 SystemAccount 一样。

```rust
    #[account(
        mut,
        seeds = [
            NONCE_VAULT_ACCOUNT_SEED,
            params.project_id.key().as_ref()
        ],
        bump,
    )]
    pub nonce_vault_account: SystemAccount<'info>,
```

这样做的好处还有，由于是一个pda账户，对其转出操作，需要合约的签名才可以。

# 二、 思路和idear记录

## 2.1 在solana中实现单例模式，某个账户只能创建一个。

我想了想，可以实现。

- 第一步，账户必须是 pda 账户，且规则确定，保证无论什么时候调用，得到的pda地址都是一样的；

> ```rust
> #[derive(Accounts)]
> pub struct InitSingletonManageProjectAccounts<'info> {
>     #[account(mut)]
>     pub payer: Signer<'info>,
> 
>     /// 管理员账户
>     pub manage_admin: Signer<'info>,
> 
>     /// 首先，单例账户必须是PDA账户，且PDA的seed固定，外部使用者无法改变
>     #[account(
>         /// 这里必须使用 init_if_needed， 放置重复初始化
>         init_if_needed,
>         payer = payer,
>         seeds = [
>             DIRECT_DISTRIBUTE_AIRDROP_MANAGER_SEED
>         ],
>         bump,
>         space = SingletonManageProject::LEN
>     )]
>     pub singlton_manage_project: Account<'info, SingletonManageProject>,
> 
>     #[account(
>         mut,
>         seeds = [
>             DIRECT_DISTRIBUTE_AIRDROP_FEE_RECEIVER_SEED,
>         ],
>         bump
>     )]
>     pub fee_receiver: SystemAccount<'info>,
> 
>     pub system_program: Program<'info, System>,
> }
> ```
> 
> 

- 第二步， 在账户中设置初始化标记，如果重复初始化则报错
  
  > ```rust
  > #[account]
  > pub struct SingletonManageProject {
  >     /// 标记是否初始化了
  >     pub inintialized: bool,
  > 
  >     /// 管理员账户
  >     /// 提取费用时，需要管理员账户签名
  >     pub manage_admin: Pubkey,
  > 
  >     /// 专门用来收钱的pda账户, 没有account-data
  >     pub fee_receiver: Pubkey,
  > 
  >     /// 每次使用合约进行空投时需要支付的费用, lamports
  >     pub user_fee: u32,
  > }
  > 
  > 
  >     msg!("initialize singleton manage project");
  > 
  >     if ctx.accounts.singlton_manage_project.inintialized {
  >         return Err(DirectDistributeAirdropErrors::AlreadyInitialized.into());
  >     }
  > 
  >     ctx.accounts
  >         .singlton_manage_project
  >         .set_inner(SingletonManageProject {
  >             inintialized: true,
  >             manage_admin: ctx.accounts.manage_admin.key(),
  >             fee_receiver: ctx.accounts.fee_receiver.key(),
  >             user_fee: params.user_fee,
  >         });
  > ```
  > 
  > 



## 2.2 在使用Anchor框架时，如何做到可变个数的账户

anchor 框架在 Accounts 结构中提供了一个 remaining_accounts 实现这个功能。

在 合约中访问 remaining_accounts 的例子：

```rust
pub fn dda_airdrop_ft<'info>(
    ctx: Context<'_, '_, '_, 'info, DdaAirdropFtAccounts<'info>>,
    params: DdaAirdropFtParams,
) -> Result<()> {
    let receiver_count = params.amounts.len();
    msg!("airdrop to {} users", receiver_count);

    // 在 anchor 中使用可变个数的
    // remaining_accounts 中循环放置 receiver_count, receivert_token_account 两个账户
    let remain_accounts_count = ctx.remaining_accounts.len();
    if remain_accounts_count != receiver_count * 2 {
        return Err(DirectDistributeAirdropErrors::AirdropReceiverCountNotMatch.into());
    }


 //....
    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();
    for i in 0..receiver_count {
        // 取出账户
        let receiver = remaining_accounts_iter.next().unwrap();
        let receiver_token_account = remaining_accounts_iter.next().unwrap();
```

> 注意！<span style="color: red;">由于 remaining_accounts 的特殊型，必须在Context中显式使用生命周期进行控制</span>



在外部的 ts 代码中访问 remaining_accounts 的例子：

```typescript
      await program.methods
        .testRemainingAccounts()
        .accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: ata, isSigner: false, isWritable: false },
          {
            pubkey: anchor.web3.Keypair.generate().publicKey,
            isSigner: false,
            isWritable: true,
          },
        ])
        
```






