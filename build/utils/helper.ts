/**
 * JS模块分包
 * @param id - 标识符
 */
export function splitJSModules(id: string) {
  // pnpm兼容
  const pnpmName = id.includes(".pnpm") ? ".pnpm/" : "";
  const fileName = `node_modules/${pnpmName}`;

  // if (id.includes("node_modules")) {
  //   if (id.includes("echarts")) {
  //     return "vendor_echarts";
  //   }
  //   if (id.includes("@wangeditor")) {
  //     return "vendor_@wangeditor";
  //   }
  //   if (id.includes("antd")) {
  //     return "vendor_antd";
  //   }
  //   // 其余 node_modules 中的打包为 vendor
  //   return "vendor";
  // }

  // MARK: 这里结合http2，下面的反而稍微快一点，上面的理论上http1.1快一点
  const result = id.split(fileName)[1].split("/")[0].toString();

  return result;
}
