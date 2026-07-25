# Handoff — Scoped RBAC + 成員邀請（參考 KKTIX）

> 日期：2026-06-19 ／ 分支：`feature/authentication`

## 背景
`form-platform-server`（NestJS + Prisma + PostgreSQL，conference CFP 平台）。PM 要求權限系統「參考 KKTIX」。本次把原本的**全域扁平 RBAC** 改造為 **兩層 scope（PLATFORM / ORG / EVENT）的 scoped RBAC + Email 邀請流程**。功能已完成並通過實機驗證。

## 設計核心
1. **scopeType 三層**：`PLATFORM`（平台運營者，相容舊全域角色）、`ORG`、`EVENT`。
2. **`Membership` 取代 `MemberRole`**：成員資格 = (member, scope, role)；scope 用 `scopeType` + 可空的 `organizationId` / `activityId` FK。
3. **權限 scoped 結構**：`getScopedPermissions()` 回傳 `{ platform: string[], org: Record<orgId,string[]>, event: Record<actId,string[]> }`，存進記憶體 cache。JWT 仍只帶 `{ sub, v }`（沿用既有 TokenVersion 機制）。
4. **Guard cascade**：`@RequirePermissions({ scope, param, perms })` 從路由 param 取 scopeId；PLATFORM 全域生效；**ORG 權限向下 cascade 到該 org 旗下所有 EVENT**（guard 即時查 activity→org，並快取 `act_org:<id>`）。

## 關鍵檔案
| 區域 | 檔案 |
|------|------|
| Schema | `prisma/models/{organization,membership,invitation,role,member,activity}.prisma` |
| Migration | `prisma/migrations/20260619162429_add_scoped_rbac_org_invitation/`（已搬遷舊 member_roles → PLATFORM） |
| 權限解析 | `src/auth/auth.service.ts`（`getScopedPermissions`）、`src/auth/types/scoped-permissions.ts` |
| Guard/Decorator | `src/auth/guards/permission.guard.ts`、`src/auth/decorators/scoped-permissions.decorator.ts`（`@RequirePermissions`） |
| Cache | `src/auth/services/permissions-cache.service.ts`（含 `getActivityOrg`/`setActivityOrg`） |
| 管理 API | `src/organization/*`、`src/rbac/membership.{service,controller}.ts`、`src/rbac/role.*` |
| 邀請 | `src/invitation/*`（`invitation.service.ts` 是狀態機；`mail.service.ts` 是 log stub） |
| Seed | `prisma/seed.ts`（scoped 權限碼 + KKTIX 預設角色） |
| 測試 UI | `public/index.html`（serve 在 `/ui`） |
| 調研文件 | `docs/rbac-kktix-research.md` |

## API 重點
- `POST /organizations`（任何登入者，建立者**自動成 Owner**）、`GET /organizations`（我的）、`GET/PATCH/DELETE /organizations/:id`
- `PUT|GET /organizations/:orgId/members/:memberId/roles`、`PUT|GET /activities/:activityId/members/:memberId/roles`
- `POST|GET /organizations/:orgId/invitations`、`/activities/:activityId/invitations`、`:id/resend`、`DELETE :id`
- `POST /invitations/accept`、`/invitations/reject`（需登入，email 須與被邀者相符；過期回 **410**）
- `GET /roles/catalog`（**dev-only**，免登入，給測試 UI 載入角色下拉用；prod 會擋）

## 預設角色（seed）
- ORG：`Owner`、`Admin`（都全 org 權限）、`Accountant`（finance+report）
- EVENT：`Admin`、`Creator`、`Accountant`、`Checkin`、`Streaming`
- PLATFORM：`admin`（相容舊全域）
- 權限碼：`org:profile|finance|member:manage|report`、`event:edit|registration:read|checkin|order:manage|report|venue|member:manage`、`activity:manage|permission:manage|role:manage`（平台）

## 驗證狀態
- ✅ `pnpm build` / `pnpm lint`（0 errors，只剩 main.ts 既有 warning）/ `pnpm test`（**61 passed**）
- ✅ `prisma migrate deploy` + `db seed` 通過
- ✅ 實機煙霧測試：建組織→Owner 權限→邀請→接受→teammate 取得 org 權限，cascade 結構正常；`/roles/catalog`、`/ui` 皆正常
- ⚠️ **e2e (`test/auth.e2e-spec.ts`) 已改寫但尚未執行** —— 它的 `beforeEach` 會**清空 `DATABASE_URL` 指向的 DB**（目前指向 Zeabur 雲端 dev DB，沒有獨立 test DB），請在可拋棄的 DB 上才跑。

## 待辦 / 已知問題
1. **e2e 未跑** + 沒有獨立 test DB → 需設定 test 專用 `DATABASE_URL` 後再跑 `pnpm test:e2e`。
2. **Cascade 設計缺口**：seed 的 ORG `Owner`/`Admin` 角色**只含 `org:*` 碼，不含 event 碼**，所以預設情況下 org admin **無法** cascade 去管 event 成員。若要符合 KKTIX「組織管理員可管旗下活動」，需在 ORG 角色加入 event 範圍權限碼（產品決定）。
3. **`Activity` 建立 API 沒有帶 `organizationId`**（`CreateActivityDto` 未含），目前活動掛到 org 只能靠 Prisma Studio。若要從 API 建立掛 org 的活動，需擴充 activity DTO/service。
4. **文件漂移**：`CLAUDE.md` / `AGENTS.md` 仍描述舊的「JWT 內嵌 permissions」「全域 RBAC」模型，需更新。
5. **使用者偏好**：之後**不要再額外寫 unit/e2e 測試碼**，用實機跑過確認功能即可（本次測試碼保留不動）。

## 怎麼測（最快）
`pnpm start:dev` → 開 `http://localhost:4000/ui`：dev-login → 建組織 →（org ID / 角色下拉 / token 都會自動帶入）送邀請 → 換帳號登入 → Accept → /me 看 scoped 權限。Assign roles 面板可改某人角色 → 對方舊 token 立即失效（401）。
