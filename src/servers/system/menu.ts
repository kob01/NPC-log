import { request } from '@/servers/request'

import type { FormData } from '#/form'
import type { PageServerResult, PaginationData, SideMenu } from '#/public'

enum API {
  URL = '/api/authority/menu',
}

/**
 * 获取分页数据
 * @param data - 请求数据
 */
export function getMenuPage(data: Partial<FormData> & PaginationData) {
  return request.get<PageServerResult<FormData[]>>(`${API.URL}/page`, {
    params: data,
  })
}

/**
 * 根据ID获取数据
 * @param id - ID
 */
export function getMenuById(id: string) {
  return request.get<FormData>(`${API.URL}/detail?id=${id}`)
}

/**
 * 新增数据
 * @param data - 请求数据
 */
export function createMenu(data: FormData) {
  return request.post(API.URL, data)
}

/**
 * 修改数据
 * @param id - 修改id值
 * @param data - 请求数据
 */
export function updateMenu(id: string, data: FormData) {
  return request.put(`${API.URL}/${id}`, data)
}

/**
 * 删除
 * @param id - 删除id值
 */
export function deleteMenu(id: string) {
  return request.delete(`${API.URL}/${id}`)
}

/**
 * 获取全部菜单（供父级选择）
 */
export function getAllMenus() {
  return request.get<FormData[]>(`${API.URL}/all`)
}

/**
 * 获取当前菜单数据（侧边栏）
 * @param data - 请求数据
 */
export function getMenuList() {
  return request.get<SideMenu[]>(`/api/menu/list/v3`)
}
