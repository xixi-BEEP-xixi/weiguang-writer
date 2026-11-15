# Contributing

感谢参与微光写作台。

## 开发原则

- 保持 Windows 本地优先，不引入自有云端依赖。
- 不提交 API Key、访问令牌、用户数据库或任何个人数据。
- 不内置本地 AI 模型；AI 能力必须通过用户配置的 API 工作。
- 正文数据、长期记忆和分析报告默认保存在本机。
- 涉及 AI 修改正文时，必须保留用户确认、Diff 或恢复点。
- 新增数据表或数据格式时，同时提供迁移和恢复方案。

## 提交前检查

```powershell
cd apps/desktop
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
cargo test --manifest-path src-tauri/Cargo.toml
node node_modules/vite/bin/vite.js build
```

## Pull Request

请说明：

- 修改解决的问题
- 用户可见行为变化
- 数据迁移或兼容性影响
- 隐私和安全影响
- 已执行的测试

UI 改动请附截图或说明实际验证的窗口尺寸。AI 行为改动请说明失败、取消和恢复路径。

## 敏感信息

不要在 Issue、PR、测试数据或截图中包含：

- API Key
- 私钥
- 用户作品正文
- `%APPDATA%` 下的真实数据库
- 模型服务商账单或账号信息