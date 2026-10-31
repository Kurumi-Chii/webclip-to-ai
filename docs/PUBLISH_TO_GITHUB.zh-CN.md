# 发布到你的 GitHub 账号

建议仓库名：**webclip-to-ai**。

建议 Description：**选文送 AI：浏览器右键交付网页选文，支持自建接口与 DeepSeek Harness 当前草稿。**

建议 Topics：`browser-extension`、`chrome-extension`、`edge-extension`、`deepseek-harness`、`ai-agent`、`web-clipper`。

源码已按 MIT 许可证整理。公开发布前，可以把 LICENSE 的贡献者署名改为你自己的姓名或组织名。当前兼容性和未完成的真实窗口验收已经写在 README 中，建议保留这些说明。

## 推荐：GitHub Desktop

1. 解压 **source** 源码 ZIP，进入直接包含 `README.md`、`extension`、`packages`、`.github` 的项目目录。
2. 在 GitHub Desktop 登录自己的账号。
3. 选择 **File → Add local repository**，选择项目目录。如果提示该目录不是 Git 仓库，使用提示中的 **create a repository here** 在原目录初始化。
4. 在 Changes 检查文件。只应包含源码、说明、脚本和工作流；不要加入本机 `connection.json`、模型密钥或浏览器配置。
5. 填写首次提交说明，例如 `Initial public preview`，提交到 `main`。
6. 点击 **Publish repository**，仓库名填写 `webclip-to-ai`。希望公开时取消 **Keep this code private**，再完成发布。

不要把一个 ZIP 文件单独上传后当成源码仓库。需要上传解压后的项目内容，GitHub 才能显示 README、代码目录和工作流。

## 也可以使用 GitHub 网页

1. 在 GitHub 新建空仓库，名字 `webclip-to-ai`，不要再生成一份 README 或 LICENSE。
2. 使用 **uploading an existing file / Add file → Upload files**。
3. 上传源码根目录内的文件和文件夹，保留 `.github`、`.gitignore` 等以点开头的文件。不要多套一层项目目录。
4. 提交后确认仓库首页能直接显示 README。

如果文件选择器隐藏了以点开头的文件，使用 GitHub Desktop 更容易完整提交它们。

## 首次 Release

仓库上传后，先确认 **Actions** 中的检查成功。完整手动验收尚未完成时，把 Release 标成 **Pre-release**。

本地运行：

```sh
npm run check
npm test
npm run build
```

在 GitHub **Releases → Draft a new release** 中，使用标签 `v1.2.1`，说明可参考 `docs/RELEASE_NOTES_1.2.1.md`，附件使用 `dist/` 内的安装包、源码包和校验文件。不要附加本机配对文件。

也可以推送 `v1.2.1` 标签，触发仓库自带的 Release 工作流。它会验证版本、重新测试并生成预发布版。两种方式择一，避免重复创建同一标签的 Release。

项目目前只是本地准备好的发布源文件；这份说明不表示已经连接、创建或发布到任何 GitHub 账号。

GitHub 官方参考：[添加本地仓库到 Desktop](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop)、[通过 Desktop 发布现有项目](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop)。
