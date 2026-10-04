<div align="center">
	<h1>NPC-log</h1>
</div>

## ✨ 简介

使用 `React18`,`Typescript`,`Vite`,`Antd5.0`等主流技术开发的开箱即用的中后台前端项目，`Vite`实现自动生成路由，支持 `KeepAlive`功能，`react-redux`状态管理，支持虚拟滚动表格，`UnoCss`开发样式。

## 🚀 项目演示

## 🧩 图标(iconify)

- VS Code安装Iconify IntelliSense - 图标内联显示和自动补全

## 🎗️ Git 提交示例

### Git提交不规范会导致无法提交，`feat`关键字可以按照下面 `Git 贡献提交规范`来替换。

```
git add .
git commit -m "feat: 新增功能"
git push
```

### 按照以上规范依旧无法提交代码，请在终端执行 `npx husky install`之后重新提交。

## 🎯 Git 贡献提交规范

- 参考 [vue](https://github.com/vuejs/vue/blob/dev/.github/COMMIT_CONVENTION.md) 规范

  - `feat` 增加新功能
  - `fix` 修复问题/BUG
  - `style` 代码风格相关无影响运行结果的
  - `perf` 优化/性能提升
  - `refactor` 重构
  - `revert` 撤销修改
  - `test` 测试相关
  - `docs` 文档/注释
  - `chore` 依赖更新/脚手架配置修改等
  - `workflow` 工作流改进
  - `ci` 持续集成
  - `types` 类型定义文件更改
  - `wip` 开发中

## 🎈 路由

路由根据文件夹路径自动生成，路径包含以下文件名或文件夹名称则不生成：

- components
- utils
- lib
- hooks
- model.tsx
- 404.tsx

可自行在 src/router/utils/config.ts 修改路由生成规则。

## 🐵 关于封装

1. 功能扩展，在原有的api上拓展。
2. 功能整合，合并两个或两个以上组件的api。
3. 样式统一，避免后期样式变动，导致牵一发而动全身。
4. 公共组件二次封装或常用组件使用**Basic**开头，便于区分。
