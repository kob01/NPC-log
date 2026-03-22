import { request } from '@/servers/request'

import type { LoginResult } from '@/pages/login/model'

/**
 * 权限
 * @param data - 请求数据
 */
export function getPermissions(data: object) {
  return request.get<LoginResult>('/api/authority/user/refresh-permissions/v2', { params: data })
}
