import { request } from '@/servers/request'

import type { LoginData, LoginResult, RegisterData } from '@/pages/login/model'

/**
 * 登录
 * @param data - 请求数据
 */
export function login(data: LoginData) {
  return request.post<LoginResult>('/api/user/login', data)
}

/**
 * 注册
 * @param data - 请求数据 { username, password(已MD5), real_name }
 */
export function register(data: RegisterData) {
  return request.post<{ id: number }>('/api/user/register', data)
}

/**
 * 退出登录
 * @param data - 请求数据
 */
export function logout() {
  return request.post<LoginResult>('/api/user/logout')
}

/**
 * 修改密码
 * @param data - 请求数据
 */
export function updatePassword(data: object) {
  return request.post('/update-password', data)
}
