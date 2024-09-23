

``` bash
# 首次构建
anchor build

# 将 target/idl/nonce_verify.json 拷贝到 idls 目录下
cp target/idl/nonce_verify.json idls/

# 再次构建
anchor build

# 执行测试
anchor test

```
