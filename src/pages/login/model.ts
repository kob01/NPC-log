// 接口传入数据
export interface LoginData {
  username: string
  password: string
}

// 注册传入数据（password 已做 MD5）
export interface RegisterData {
  username: string
  password: string
  real_name?: string
}

// 用户数据
interface User {
  id: number
  username: string
  real_name?: string
  phone: string
  email: string
  account_type?: number // 0 普通用户 / 1 管理员
}

// 用户权限数据
interface Roles {
  id: string
}

// 接口返回数据
export interface LoginResult {
  token: string
  user: User
  permissions: string[]
  roles: Roles[]
}
