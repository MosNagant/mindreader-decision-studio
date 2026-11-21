# 在自己的 Make 工作区运行

网页的出题、提交答案、生成画像共用一个 Webhook。部署网页时，导入 `00_entry.blueprint.json`。如果要让三个动作各有自己的执行历史，可以另建三个场景，分别导入 `01_start_game.blueprint.json`、`02_submit_choice.blueprint.json` 和 `03_generate_profile.blueprint.json`。分拆版配有独立的 Hoppscotch 集合。

## 准备 Google Sheets

在自己的 Google 表格里建立以下三个工作表，名称全部小写。按顺序把每个代码块的一行复制到对应工作表的 A1，字段之间是制表符。查询和历史汇总使用了列位置。

**answers**

```text
record_key	user_id	round_no	scenario_id	question	option_a	option_b	option_c	option_d	user_choice	decision_ms	ai_prediction	ai_confidence	is_correct	difficulty	created_at
```

**scores**

```text
record_key	user_id	round_no	ai_score	user_score	difficulty	ai_guessed	created_at
```

**profiles**

```text
user_id	personality_type	trait1_name	trait1_score	trait2_name	trait2_score	trait3_name	trait3_score	summary	evidence_rounds	confidence_level	version	updated_at
```

## 导入与绑定

1. 在 Make 创建空白 Scenario，从编辑器菜单选择 **Import blueprint**，导入所选文件。
2. 打开 Webhooks 模块 1，创建本场景使用的 Custom webhook。用 `structures/webhook-input.json` 作为入参结构样例。该文件包含题干及四个选项，使答题时能传回上一轮生成的完整内容。可以在新场景尚未启用时通过 **Redetermine data structure** 采样；完成配置后再发端到端请求。
3. 在每个 Google Sheets 模块选择自己的连接、表格和对应工作表。模块 17、31、43、49 使用 `profiles`，20、26、34 使用 `answers`，27 使用 `scores`。保留原有筛选条件和字段映射。
4. 在 HTTP 模块 11、22、39 选择自己的 OpenRouter API Key 连接。其 HTTP 请求使用 `Authorization` 请求头，值为 `Bearer`、一个空格和自己的密钥。模块 22、39 的 JSON 请求体使用下表中的 `llm-request` 结构。
5. 为 JSON 模块重新选择当前工作区的数据结构。创建结构时点 **Generate**，粘贴下表对应文件的内容。示例值仅供推断字段类型，模块中的动态映射提供实际内容。成功回执中可为空的 `error` 字段，在样例中使用文本以便识别类型。选择结构后核对题目、选项、画像字段和请求 ID 的映射。
6. 保存场景，启用 Webhook 即时触发。在网页 Worker 设置服务端 secret `MAKE_ENTRY_WEBHOOK`，填入统一入口模块 1 的地址。通过 Hoppscotch 测试分拆版时，在本地环境分别填入三个 Webhook 地址。

| Make 模块 | structures 中的文件 |
| --- | --- |
| 1 Webhook 入参 | webhook-input.json |
| 11 调用模型 | 使用蓝图内的 JSON 字符串 |
| 13 解析题目、18 生成出题回执 | question.json、question-response.json |
| 22、39 调用模型 | llm-request.json |
| 23 解析预测、28 生成计分回执 | prediction.json、prediction-response.json |
| 30 重复提交回执 | duplicate-response.json |
| 41 解析画像 | profile.json |
| 33、47、50 缓存与生成画像回执 | profile-response.json |

## 核对执行

调用顺序为 `start_game → submit_choice → generate_profile`。答题成功后，`answers` 和 `scores` 应各新增一行。首次生成画像后，`profiles` 应新增一行；使用同一用户和 `force_refresh: false` 会优先读取该画像。可在 Make 的 **History** 打开对应执行，检查 Webhook 输入中的 `request_id`、Sheets 模块的写入结果和最终业务回执。联调步骤见 [Hoppscotch 测试说明](../hoppscotch/README.md)。
