/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV: string
  readonly VITE_BASE_URL: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_SERVER_PORT: string
  readonly VITE_SECRET_KEY: string
  readonly VITE_AMAP_KEY: string
  readonly VITE_AMAP_SECURITY_CODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// coordtransform 无官方类型声明，此处补充（仅声明项目用到的方法）
declare module 'coordtransform' {
  /** WGS-84 转 GCJ-02，返回 [lng, lat] */
  export function wgs84togcj02(lng: number, lat: number): [number, number]
  /** GCJ-02 转 WGS-84，返回 [lng, lat] */
  export function gcj02towgs84(lng: number, lat: number): [number, number]
  /** BD-09 转 GCJ-02，返回 [lng, lat] */
  export function bd09togcj02(lng: number, lat: number): [number, number]
  /** GCJ-02 转 BD-09，返回 [lng, lat] */
  export function gcj02tobd09(lng: number, lat: number): [number, number]
}
