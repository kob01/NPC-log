### 菜单路由说明

- 顶级key使用顶级目录名
- 次级都采用`/顶级key/当前目录/当前页`
- 菜单key为跳转路由地址，需与文件目录结构相符

### 菜单路由key：

```
├─ 顶级Key
| └─ /顶级key/当前目录
|    └─ /顶级key/当前目录/当前页
└─ system
    ├─ /system/user
    └─ /system/menu
```

> 补充：侧边栏菜单由后端 `note_menus` 动态下发（`GET /api/menu/list/v3`），
> 并在 `src/layouts/components/Menu.tsx` 里硬编码前置「NPC存档 / 定时提醒 / AI超级记忆」等入口；
> 原静态菜单 `defaultMenus`（`src/menus/index.ts`）已移除。
