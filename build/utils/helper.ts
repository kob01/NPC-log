/**
 * JS模块分包
 * @param id - 标识符
 */
export function splitJSModules(id: string) {
  // pnpm兼容
  const pnpmName = id.includes('.pnpm') ? '.pnpm/' : '';
  const fileName = `node_modules/${pnpmName}`;

  const result = id
    .split(fileName)[1]
    .split('/')[0]
    .toString();

  return result;
}
