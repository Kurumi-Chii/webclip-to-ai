# 隐私说明 / Privacy

## 浏览器扩展

- 不收集遥测、浏览记录或账户身份，不使用广告、统计 SDK、远程脚本。
- 仅在用户打开扩展时读取当前页选区，或在用户主动右键提交后，按需读取被点击框架的当前选区。右键原文只有与原生菜单选文折叠空白后相同时才被采用，避免页面在菜单打开期间替换所选文字；没有常驻选区监控。
- 只在用户点击发送 / 提交测试文字时发起交付请求。页面内结果提示通过按需注入显示，不包含密钥或选文原文。
- 通用 HTTP 模式发送模板中的数据。默认包括选文、来源标题和网址；可以删除来源字段。
- Harness 模式的默认模板仅发送文字，接收地址限定于用户导入的本机回环地址。
- 接口地址、令牌和自定义请求头保存在本机扩展存储，不进行浏览器云同步。这不是加密密钥库。
- 最近一次选文、状态和回复保存在浏览器会话存储，浏览器会话结束后清除。回复最多预览 8,000 字符，以纯文本显示。
- 导入 `connection.json` 时在扩展本地解析文件，不上传文件，也不采用文件中的任意请求模板或自定义请求头。

## Harness 接收插件

- 仅监听 `127.0.0.1`，默认端口 `18766`；本地交付需要每台电脑独立生成的 Bearer 配对码。
- 配对文件保存在 `$DSH_HOME/webclip-to-ai/connection.json`，未设置 `DSH_HOME` 时使用 `~/.dsh`。
- 不读取模型 API Key，不调用模型，不自动提交消息。
- 待交付选文只在内存中保留，最多等待 12 秒。已经写入的草稿由 Harness 自己保存，遵循其隐私与存储设置。
- 停用接收插件会关闭监听端口并取消待确认交付。

## 第三方服务

向通用接口发送数据后，接收端的保存和处理行为由该服务决定。在 Harness 中手动发送草稿后，文本会依照你在 Harness 中选择的模型提供商与相关配置处理。

## Permissions in brief

The extension uses `activeTab`, `scripting`, `contextMenus`, and `storage`. Endpoint host access is requested when users save configuration. There are no automatically injected all-site content scripts. Chromium host permission grants apply to a host and scheme, not an individual API path or port.

No runtime pairing file or shared authentication secret is included in public release archives.
