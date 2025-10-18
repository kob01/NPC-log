// .eslintrc.cjs
module.exports = {
  // 指定 ESLint 运行环境
  env: {
    browser: true,
    es2021: true,
    node: true, // 如果项目中有 Node.js 代码（如配置文件）
  },
  // 继承推荐的规则集
  extends: [
    'eslint:recommended', // ESLint 推荐规则
    'plugin:react/recommended', // React 推荐规则 (如果使用 React)
    'plugin:react-hooks/recommended', // React Hooks 推荐规则
    'plugin:@typescript-eslint/recommended', // TypeScript 推荐规则
    'plugin:prettier/recommended', // 启用 eslint-plugin-prettier 和 eslint-config-prettier。必须放在最后。 [[9]]
  ],
  // 指定要使用的解析器
  parser: '@typescript-eslint/parser',
  // 解析器选项
  parserOptions: {
    ecmaFeatures: {
      jsx: true, // 启用 JSX
    },
    ecmaVersion: 'latest', // 使用最新的 ECMAScript 版本
    sourceType: 'module', // 使用 ES 模块
  },
  // 指定要使用的插件
  plugins: [
    'react',
    'react-hooks',
    '@typescript-eslint',
    'prettier', // [[9]]
  ],
  // 自定义规则 (可选)
  rules: {
    // 你可以在这里覆盖或添加特定规则
    // 例如，强制在使用 Prettier 时，如果 ESLint 修复了问题，也应用 Prettier 格式化 [[9]]
    'prettier/prettier': 'error',
    // 确保 React 组件文件能正确识别 React
    'react/react-in-jsx-scope': 'off', // React 17+ 不再需要显式导入 React
  },
  // 设置 React 版本 (如果使用 React)
  settings: {
    react: {
      version: 'detect', // 自动检测 React 版本
    },
  },
}
