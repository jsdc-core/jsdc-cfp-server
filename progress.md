# Scoped RBAC（參考 KKTIX）實作進度

> **2026-06-19 更新**：在既有 TokenVersion + Cache 機制上，新增「參考 KKTIX」的兩層 scope RBAC（PLATFORM / ORG / EVENT）+ Email 成員邀請流程。
>
> - 調研文件：[docs/rbac-kktix-research.md](docs/rbac-kktix-research.md)
> - 設計與計畫：見 plan 檔
>
> **本次完成**：
> 1. **Schema/Migration** — 新增 `Organization`、`Membership`（取代全域 `MemberRole`，帶 scopeType + org/activity FK）、`Invitation`；`Role.scope`、`Activity.organizationId`；migration 已搬遷既有 member_roles → PLATFORM。
> 2. **權限解析 scoped** — `AuthService.getScopedPermissions` 回傳 `{platform, org, event}`，存入 cache；JWT 仍只帶 `{sub, v}`。
> 3. **Guard + `@RequirePermissions`** — 依路由 param 解析 scopeId，PLATFORM 全域生效，**org 權限向下 cascade 到旗下 event**（即時查 activity→org，含快取）。
> 4. **管理 API** — `Organization` CRUD（建立者自動成為 Owner）、scoped 成員角色管理（`/organizations|activities/:id/members/:memberId/roles`）。
> 5. **邀請流程** — `Invitation` service/controller：invite / accept / reject / resend / revoke，7 天時效、Email 比對、`MailService` stub。
> 6. **Seed** — scoped 權限碼 + KKTIX 預設角色（ORG: Owner/Admin/Accountant；EVENT: Admin/Creator/Accountant/Checkin/Streaming）。
> 7. **驗證** — `pnpm build` / `pnpm lint`（0 errors）/ `pnpm test`（**61 passed**）；`npx prisma migrate deploy` + `db seed` 通過；本機 runtime 煙霧測試：建立組織→Owner 權限→邀請→接受→teammate 取得 org-scoped 權限，全數通過。
>   - e2e（`test/auth.e2e-spec.ts`）已改寫為 scoped 流程，**尚未執行**（會清空 DATABASE_URL 指向的 DB，請在可拋棄的 DB 上跑）。

---

# TokenVersion + Permissions Cache 實作進度（前一階段）

## 目前狀態

**分支**：`feature/authentication`  
**Plan 狀態**：✅ 已通過審核，已拆為 6 個 Task  
**執行範圍**：Phase 1 ~ Phase 7（**全部完成**）

---

## Task 清單

| # | Phase | 狀態 | 說明 |
|---|-------|------|------|
| 1 | Phase 1: Add tokenVersion to schema and migrate | ✅ `completed` | `prisma/models/member.prisma` 已新增 `tokenVersion Int @default(1)`；migration `20260607143147` 已執行；Prisma client 已重新生成 |
| 2 | Phase 2: Setup cache infrastructure | ✅ `completed` | 安裝 `@nestjs/cache-manager` + `cache-manager`；`AppModule` 已註冊 `CacheModule`；新建 `src/auth/services/permissions-cache.service.ts` |
| 3 | Phase 3: Update auth service login flow | ✅ `completed` | `auth.service.ts`：JWT payload 改為 `{ sub, v }`；登入時把 permissions / tokenVersion 寫入 cache；新增 `bumpTokenVersion()` / `invalidateUserCache()` |
| 4 | Phase 4: Update JwtStrategy | ✅ `completed` | `JwtPayloadToken` 移除 `permissions`；`validate()` 注入 `PermissionsCacheService` + `PrismaService`；驗證 tokenVersion 並從 cache 讀 permissions |
| 5 | Phase 5: Simplify PermissionGuard | ✅ `completed` | `PermissionGuard` 直接比對 `req.user.permissions`（由 JwtStrategy 預先從 cache 載入） |
| 6 | Phase 7: Adjust seed and verify | ✅ `completed` | Seed 無需改動（不直接創建 member）；手動測試通過：舊 token bump 後回 401，重新登入後新 token 正常 |

---

## 單元測試（本次新增）

| 測試檔案 | 測試內容 | 狀態 |
|---------|---------|------|
| `src/auth/services/permissions-cache.service.spec.ts` | set/get/invalidate permissions 與 tokenVersion | ✅ 7 tests pass |
| `src/auth/strategies/jwt.strategy.spec.ts` | validate：cache hit、cache miss fallback、tokenVersion 不匹配、用戶不存在 | ✅ 6 tests pass |
| `src/auth/guards/permission.guard.spec.ts` | 無權限要求、未認證、有權限、缺權限 | ✅ 5 tests pass |
| `src/auth/auth.service.spec.ts` | getUserPermissions、devLogin、bumpTokenVersion、invalidateUserCache | ✅ 8 tests pass |

**總計：26 tests pass / 26 total**

---

## Git 工作區狀態

```
On branch feature/authentication
尚未提交的變更（本次測試相關）：
  modified:   package.json
  new file:   src/auth/services/permissions-cache.service.spec.ts
  new file:   src/auth/strategies/jwt.strategy.spec.ts
  new file:   src/auth/guards/permission.guard.spec.ts
  new file:   src/auth/auth.service.spec.ts
```

---

## 設計摘要

將登入機制從「JWT 內嵌 permissions 字串陣列」改為 **TokenVersion + In-Memory Cache**：

1. **JWT 最小化**：只帶 `sub`（memberId）+ `v`（tokenVersion），不再內嵌 email 與 permissions。
2. **Permissions 走 Cache**：登入時把 `permissions` 與 `tokenVersion` 寫入 `@nestjs/cache-manager` 記憶體快取。
3. **每次請求驗證**：`JwtStrategy.validate()` 從快取讀 `tokenVersion` 比對 JWT 的 `v`，不匹配則 `throw UnauthorizedException('Token has been revoked')`；permissions cache miss 時 fallback 查 DB 並回填快取。
4. **即時失效**：管理後台變更用戶角色後呼叫 `AuthService.bumpTokenVersion(memberId)`，會自動 `++tokenVersion` 並 invalidate cache，舊 JWT 立即失效（401）。

---

## 品質檢查結果

| 檢查項目 | 結果 |
|---------|------|
| `pnpm build` | ✅ 通過 |
| `pnpm lint` | ✅ 通過 |
| `pnpm test` | ✅ **26 passed / 26 total** |
| `npx prisma db seed` | ✅ 通過 |
| **手動 E2E 測試** | ✅ 通過 |

### E2E 測試記錄

| 步驟 | 預期 | 實際 |
|------|------|------|
| dev-login 取得 token | 拿到 `v=1` 的 JWT | ✅ |
| 帶 token 訪問受保護路由 | 403（token 有效但缺權限） | ✅ |
| 呼叫 bumpTokenVersion | tokenVersion 變為 2 | ✅ |
| 帶舊 token 再次訪問 | 401（token revoked） | ✅ |
| 重新登入取得新 token | 拿到 `v=2` 的 JWT | ✅ |
| 帶新 token 訪問 | 403（token 有效） | ✅ |
