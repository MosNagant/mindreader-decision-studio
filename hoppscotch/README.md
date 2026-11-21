# 用 Hoppscotch 跑一局

在仓库根目录执行 `node hoppscotch/create-environments.mjs`，即可在本机的 `hoppscotch/local/` 生成下文所需的两份环境文件。所有 Webhook 地址初始为空；再次运行会保留现有文件。

1. 在 Collections 导入 `entry.collection.json`，在 Environments 导入 `entry.environment.json` 并选中它。在环境的 `webhook_url` 填自己 Make 场景的地址。
2. 发送 **01 新一轮**。脚本创建独立用户和请求编号，保存 LLM 返回的题干、选项、难度与题目 ID。
3. 阅读返回的选项，把环境中的 `choice` 设为想选的 `A`、`B`、`C` 或 `D`，发送 **02 选择答案**。脚本带上刚生成的题目，返回预测和分数，并将本轮写入 `answers`、`scores`。
4. 发送 **03 LLM 生成新画像**，检查返回的画像和 `profiles` 新增记录。重新发送 01 会创建另一局新用户。每次应等上一步收到 `ok: true` 的 JSON 再继续。仅返回 `Accepted` 时，可用本轮 `request_id` 在 Make History 核对执行状态后再操作。

测试独立三个场景时，导入 `split.collection.json` 和 `split.environment.json`，在所选本地环境填入 `start_game_url`、`submit_choice_url` 和 `generate_profile_url`，然后按同样顺序发送请求。各 Webhook 地址应只保存在自己的环境中。
