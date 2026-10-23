/**
 * JS模块分包
 * @param id - 标识符
 */
export function splitJSModules(id: string) {
  // pnpm兼容
  const pnpmName = id.includes('.pnpm') ? '.pnpm/' : ''
  const fileName = `node_modules/${pnpmName}`

  // MARK: 这里结合http2，下面的反而稍微快一点，上面的理论上http1.1快一点
  const result = id.split(fileName)[1].split('/')[0].toString()

  return result
}
