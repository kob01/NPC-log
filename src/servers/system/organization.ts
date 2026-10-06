import { request } from '@/servers/request'

import type { FormData } from '#/form'
import type { PageServerResult, PaginationData } from '#/public'

enum API {
  URL = '/api/organization',
}

// 组织（管理员 CRUD）
export function getOrgPage(data: Partial<FormData> & PaginationData) {
  return request.get<PageServerResult<FormData[]>>(`${API.URL}/page`, { params: data })
}

export function getAllOrgs() {
  return request.get<FormData[]>(`${API.URL}/all`)
}

export function getOrgById(id: string) {
  return request.get<FormData>(`${API.URL}/detail?id=${id}`)
}

export function getOrgMembers(orgId: string) {
  return request.get<FormData[]>(`${API.URL}/members`, { params: { orgId } })
}

export function createOrg(data: FormData) {
  return request.post(API.URL, data)
}

export function updateOrg(id: string, data: FormData) {
  return request.put(`${API.URL}/${id}`, data)
}

export function deleteOrg(id: string) {
  return request.delete(`${API.URL}/${id}`)
}

// 用户自助
export function getPublicOrgs() {
  return request.get<FormData[]>(`${API.URL}/public`)
}

/** 申请加入（理由可选，会展示给该组织管理者） */
export function applyJoin(orgId: string | number, reason?: string) {
  return request.post(`${API.URL}/apply`, { orgId, reason })
}

export function getMyOrgs() {
  return request.get<FormData[]>(`${API.URL}/mine`)
}

/** 我提交的申请记录（进行中为主，含待审/通过/拒绝） */
export function getMyApplications() {
  return request.get<FormData[]>(`${API.URL}/applications`)
}

/** 已结束的审批记录：我申请的 + 我管理的组织里别人的 */
export function getMyRecords() {
  return request.get<FormData[]>(`${API.URL}/records`)
}

export function leaveOrg(orgId: string | number) {
  return request.post(`${API.URL}/leave`, { orgId })
}

// 管理者：审批 / 升降级
export function getPendingRequests(orgId?: string | number) {
  return request.get<FormData[]>(`${API.URL}/requests`, { params: orgId ? { orgId } : {} })
}

// 待审批申请总数（仅统计我管理的组织，用于全局红点轮询）
export function getPendingCount() {
  return request.get<number>(`${API.URL}/requests/count`)
}

export function auditRequest(data: {
  orgId: string | number
  userId: string | number
  approved: boolean
  /** 拒绝理由，可选（通过后回显给申请人） */
  reason?: string
}) {
  return request.post(`${API.URL}/audit`, data)
}

export function setOrgManager(data: { orgId: string | number; userId: string | number; role: number }) {
  return request.post(`${API.URL}/manager`, data)
}

/** 移出成员（仅该组织的管理者/创建者，不能移自己也不能移创建者） */
export function kickMember(orgId: string | number, userId: string | number) {
  return request.post(`${API.URL}/kick`, { orgId, userId })
}

// 系统管理员：为用户分配组织
export function getUserOrgs(userId: string) {
  return request.get<number[]>(`/api/authority/user/${userId}/organizations`)
}

export function setUserOrgs(userId: string, orgIds: number[]) {
  return request.put(`/api/authority/user/${userId}/organizations`, { orgIds })
}
