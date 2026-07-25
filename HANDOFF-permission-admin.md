# HANDOFF — 權限管理後台（前端）

> 給接手繼續開發的人。自足文件。
> 建立：2026-07-25。對照後端 RBAC 交接見 [`HANDOFF.md`](HANDOFF.md)、[`progress.md`](progress.md)、KKTIX 調研見 [`docs/rbac-kktix-research.md`](docs/rbac-kktix-research.md)。

## 一句話

後端的「參考 KKTIX」scoped RBAC（PLATFORM / ORG / EVENT + Email 邀請）**已完成並有測試**；前端 admin 只做完了**組織層的角色指派**，活動層與邀請 UI 尚未做。這份文件記錄實測到的進度與待辦。

---

## 目前進度（2026-07-25 實測）

前端 `web/`（Vite + React + shadcn/ui + react-router），登入用 dev-login（`yale@agent.local` 是唯一有 `permission:manage` 的帳號）。

| 頁面 / 分頁 | 後端端點 | 前端 | 實測狀態 |
|---|---|---|---|
| 成員管理 `/members` | `GET/POST/PATCH/DELETE /members` | ✅ | 列表、CRUD 正常 |
| 角色 `/permissions`（預設） | `GET/POST/PATCH/DELETE /roles` | ✅ | 9 個角色 + 權限勾選正常 |
| 權限碼 `/permissions/permissions` | `GET/POST/PATCH/DELETE /permissions` | ✅ | 14 筆權限碼正常 |
| **組織成員** `/permissions/org-members` | `GET /members/organization/:orgId`、`PUT /organizations/:orgId/members/:memberId/roles` | ✅ | **端到端驗過**：建組織→選組織→列成員→管理角色→儲存→DB 確認寫入 |
| **成員** `/permissions/members` | （同組織成員） | ❌ | **placeholder 空殼**（`members-coming-soon.tsx`），且承諾的功能與「組織成員」重複 |
| **活動成員（EVENT scope）** | `GET/PUT /activities/:activityId/members/:memberId/roles`（後端已有） | ❌ | **前端完全沒做** |
| **Email 邀請** | 見下方端點清單（後端完整） | ❌ | **前端完全沒做**（一個畫面都沒有） |

**判斷**：當「後端 API + 權限引擎」交付可以；當「給人用的 KKTIX-like 權限後台」交付**還不行**，缺活動層 + 邀請兩塊硬功能。

---

## 待辦 TODO（依優先序）

### 高 — 補齊 KKTIX 兩層裡缺的活動層
- [ ] **活動成員角色指派頁**。後端端點已就緒（`GET/PUT /activities/:activityId/members/:memberId/roles`，需 `event:member:manage`）。可直接照 `web/src/pages/permissions/org-members-page.tsx` 的結構複製一份，把 org 換成 activity、角色 catalog 抓 `EVENT` scope（`listRoleCatalog("EVENT")`）。
- [ ] 活動下拉的資料來源：目前前端沒有活動列表 API 的封裝，需確認 `GET /activities`（或等價端點）並加 `web/src/lib/` 封裝。

### 高 — 補齊 KKTIX 招牌的邀請流程 UI
- [ ] **邀請管理頁**（組織 + 活動）。後端端點：
  - `GET /organizations/:orgId/invitations`、`POST /organizations/:orgId/invitations`、`POST /organizations/:orgId/invitations/:id/resend`
  - `GET /activities/:activityId/invitations`、`POST …`、`POST …/:id/resend`
  - `POST /invitations/accept`、`POST /invitations/reject`（受邀者端，帶 token）
- [ ] 邀請狀態機 UI：PENDING / ACCEPTED / EXPIRED（7 天）等狀態呈現，見調研文件第 4 節。

### 中 — 清理與收尾
- [ ] **移除重複的「成員」placeholder 分頁**（`web/src/pages/permissions/members-coming-soon.tsx` + router `permissions/members`）。它承諾的東西「組織成員」已做完，留著只會誤導。
- [ ] **user-menu 顯示錯誤**：登入後左下角仍顯示「訪客 guest@example.com」，未反映實際登入者。需接 `/auth/me`（或等價）把當前使用者帶進 `user-menu.tsx`。router 註解也提到「route guard can be added once /auth/me is wired up」。
- [ ] **cascade 產品決策**（見 `HANDOFF.md` 第 49 點）：seed 的 ORG `Owner`/`Admin` 只含 `org:*`、不含 event 碼，所以預設 org admin 無法 cascade 管活動。要符合 KKTIX「組織管理員可管旗下活動」需在 ORG 角色加 event 權限碼。這是產品決定，非純工程。

---

## 已知行為（不是 bug，記下來免得誤判）

- **改自己的角色會被登出**。改角色 → 後端 `bumpTokenVersion(memberId)`（`src/rbac/membership.service.ts:113`）使舊 JWT 失效 → 前端攔截器 401 → 踢回登入。這是正確的權限即時失效機制；只是自己改自己時體感像閃退。改別人不會。
- **組織成員頁「你目前不屬於任何組織」**：當登入者不屬於任何組織時的正常空狀態，不是壞掉。建組織後即消失。

---

## 本機怎麼跑

```bash
# 後端（讀本機 dev DB，見下）
cd form-platform-server && pnpm start:dev            # :4000

# 前端
cd form-platform-server/web && pnpm dev              # :3000（被佔會往上找，本次實測在 :3003）
```

- 前端 API base 走**相對路徑 + vite proxy**（`web/.env` 的 `VITE_API_BASE_URL` 已註解掉），所以前端跑在哪個 port 都能連後端，不吃 CORS。若要直打後端絕對網址，必須同步把該 port 加進後端 `.env` 的 `CLIENT_URL`。
- 登入：`/login` 下半部 dev-login，email 填 `yale@agent.local`（唯一有 `permission:manage`）。GitHub 按鈕目前不能用（`GITHUB_CLIENT_ID` 為空，未設 OAuth app），dev-login 才是可用路徑。

## 資料庫

- 本機開發已改用 **local `form_platform_dev`**（`DATABASE_URL` 指 localhost；原雲端 Zeabur 那條保留成 `.env` 裡的註解 `# PROD_DATABASE_URL`）。
- e2e 用 **local `form_platform_test`**（`TEST_DATABASE_URL`），`test/jest-e2e.setup.ts` 會 abort 任何非 localhost 主機——已實測負向測試（缺變數 / 遠端主機都會擋）。
- dev DB 目前種子：14 permissions + 9 roles + `yale@agent.local`(PLATFORM admin) + 測試組織「COSCUP 測試組織」(yale=Owner+Accountant)。**沒有活動資料**，所以活動層功能要先建 activity 才驗得動。
