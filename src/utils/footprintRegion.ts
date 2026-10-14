import type { RegionNode } from '@/servers/content/memory'

/** antd Cascader 直接吃的节点形状 */
export type RegionOption = { value: string; label: string; children?: RegionOption[] }

/**
 * 把后端返回的区域树转成 Cascader 选项，并给标签带上点数控件
 * （与年份下拉的「2026 (16)」同一风格，用户不用点开就知道哪档有东西）
 *
 * 只重拼 label，不动 value：value 要原样当 `region` 参数发回后端
 * （'province:江苏省' / 'city:苏州市' / 'district:昆山市'）。
 * 叶子节点不带 children 键：antd 见到空数组会画一个可点的「+」，点了却是空的。
 *
 * PC 的 /content/footprint 与移动版的 /m/footprint 共用这一份：两端各自的
 * 「选项只列存在点的档位」口径由后端保证，这里只负责形状转换。
 */
export function toCascaderOptions(nodes: RegionNode[] | undefined): RegionOption[] {
  return (nodes || []).map((n) => ({
    value: n.value,
    label: `${n.label}(${n.count})`,
    ...(n.children && n.children.length ? { children: toCascaderOptions(n.children) } : {}),
  }))
}

/** 从 Cascader 的路径值里取出要发给后端的 region（停在省或市也算，取末档） */
export function regionOfPath(path: string[]): string | undefined {
  return path && path.length ? path[path.length - 1] : undefined
}
