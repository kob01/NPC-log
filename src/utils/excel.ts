import * as XLSX from 'xlsx'

/**
 * 导出数据到Excel
 * @param data - 要导出的数据
 * @param filename - 文件名
 * @param sheetName - 工作表名称
 */
export function exportToExcel<T extends Record<string, unknown>>(data: T[], filename: string, sheetName: string = 'Sheet1') {
  if (!data || data.length === 0) {
    return false
  }

  // 创建工作簿
  const wb = XLSX.utils.book_new()

  // 创建工作表
  const ws = XLSX.utils.json_to_sheet(data)

  // 将工作表添加到工作簿
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // 导出文件
  XLSX.writeFile(wb, `${filename}.xlsx`)

  return true
}

/**
 * 格式化数据用于导出
 * @param data - 原始数据
 * @param columns - 列配置
 */
export function formatDataForExport<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; title: string }[],
): Record<string, unknown>[] {
  return data.map((item) => {
    const formatted: Record<string, unknown> = {}
    columns.forEach((col) => {
      formatted[col.title] = item[col.key] ?? ''
    })
    return formatted
  })
}
