import { request } from '@/servers/request'

import type { FormData } from '#/form'
import type { PageServerResult, PaginationData } from '#/public'

type RoleData = {
  id: string
  name: string
  code: string
  description?: string
  status: number
  sort_order?: number
  created_at?: string
  updated_at?: string
}

enum API {
  URL = '/api/authority/role',
}

/**
 * 获取分页数据
 * @param data - 请求数据
 */
export function getRolePage(data: Partial<FormData> & PaginationData) {
  return request.get<PageServerResult<RoleData[]>>(`${API.URL}/page`, {
    params: data,
  })
}

/**
 * 获取所有角色（下拉选择用）
 */
export function getAllRoles() {
  return request.get<RoleData[]>(`${API.URL}/all`)
}

/**
 * 根据ID获取数据
 * @param id - ID
 */
export function getRoleById(id: string) {
  return request.get<RoleData>(`${API.URL}/detail?id=${id}`)
}

/**
 * 新增数据
 * @param data - 请求数据
 */
export function createRole(data: FormData) {
  return request.post(API.URL, data)
}

/**
 * 修改数据
 * @param id - 修改id值
 * @param data - 请求数据
 */
export function updateRole(id: string, data: FormData) {
  return request.put(`${API.URL}/${id}`, data)
}

/**
 * 删除
 * @param id - 删除id值
 */
export function deleteRole(id: string) {
  return request.delete(`${API.URL}/${id}`)
}

/**
 * 获取角色菜单权限
 * @param roleId - 角色ID
 */
export function getRoleMenus(roleId: string) {
  return request.get<number[]>(`${API.URL}/menus?roleId=${roleId}`)
}

/**
 * 保存角色菜单权限
 * @param data - 请求数据
 */
export function saveRoleMenus(data: { roleId: string; menuIds: string[] }) {
  return request.post(`${API.URL}/menus`, data)
}

/**
 * 获取用户角色
 * @param userId - 用户ID
 */
export function getUserRoles(userId: string) {
  return request.get<number[]>(`/api/authority/user/roles?userId=${userId}`)
}

/**
 * 保存用户角色
 * @param data - 请求数据
 */
export function saveUserRoles(data: { userId: string; roleIds: string[] }) {
  return request.post(`/api/authority/user/roles`, data)
}
