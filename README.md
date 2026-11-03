# 学生积分管理系统

支持 Excel / CSV 名单导入、自定义积分规则、批量加减分、积分总览和变动明细。默认初始积分 60 分，已内置约定的 11 项规则；“其他事项”可自主填写分值。

## 部署到 GitHub Pages

**请将本地 student-points 目录里面的文件作为 GitHub 仓库根目录，不要在仓库中再套一层 student-points。** 应能在仓库首页直接看到 dist/、tests/、package.json 和 .github/。

1. 在自己的 GitHub 账号创建仓库，把项目源文件提交到 main 分支。保留 .github/workflows/pages.yml 与 dist/vendor/ 中的 Excel 组件及许可证。
2. 打开仓库 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. main 分支更新时会自动部署；也可进入 **Actions → Deploy student points to GitHub Pages → Run workflow** 手动运行。首次上传早于启用 Pages 时，启用后手动运行一次。
4. 工作流检查 dist/app.js、dist/data.js 的语法并运行核心测试，通过后只上传 dist/，随后发布。
5. 等待 build、deploy 成功，在 **Settings → Pages** 查看实际网站地址。之后更新 main 会自动重新发布。

不需要安装 npm 依赖或构建前端。页面使用相对资源路径，支持 GitHub Pages 的仓库子路径。Pages 的可用范围取决于账号套餐和仓库可见性，详见 [GitHub 官方工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 数据保存与迁移

**当前仍使用浏览器 localStorage，没有登录、云数据库或跨设备同步。** GitHub 保存网站代码，GitHub Pages 托管网页；部署不会把学生名单和积分自动保存到云端。

数据依赖当前网址和浏览器。清理浏览器数据、使用无痕模式、换电脑或换网址，都可能导致原有数据无法访问，因此请定期点击右上角“备份数据”，另存完整 JSON 备份。

从本地版本迁移到 Pages 时，先在旧位置备份，再在新网站点击“恢复备份”，核对学生、规则和历史记录后继续使用。恢复会替换新位置的全部系统数据。完整迁移应使用 JSON，Excel 导出用于查看。

后续可接入 **Supabase 登录和数据库**，实现教师账号、云端保存与跨设备同步；这些功能目前尚未实现。请保留 JSON 备份，方便后续迁移。

## 提交文件

不要上传真实学生名单、JSON 备份、密钥或 .openai 本地配置。.gitignore 已排除常见备份、学生表格、运行数据、离线单文件与截图；通过网页手动上传时仍需检查文件清单。dist/vendor/LICENSE-sheetjs.txt 应随源文件保留。

当前没有教师身份验证。普通公开 Pages 网页可被访问，请勿把网址当作登录保护，也不要把学生数据或数据库管理密钥写入仓库和浏览器代码。

## 本地运行与检查

在 student-points 目录运行以下命令，再打开 [本地预览](http://127.0.0.1:4173)：

```text
node server.cjs
```

检查命令与部署工作流一致：

```text
node --check dist/app.js
node --check dist/data.js
node --test tests/core.test.cjs
```

详细使用步骤见“使用说明.md”。Excel 组件为 SheetJS CE 0.20.3，许可证在 dist/vendor/LICENSE-sheetjs.txt。工作流 Node 环境使用 [官方 setup-node Action](https://github.com/actions/setup-node)。
