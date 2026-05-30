- 核准 build 腳本(解決你之前那個 ERR_PNPM_IGNORED_BUILDS)。會跳出清單,用空白鍵勾選 prisma、@prisma/engines、esbuild、@nestjs/core,Enter 確認:
 pnpm approve-builds

- 產生 Prisma client:
  npx prisma generate
  
# 選配：這步不一定要 看有沒有需要 migration
- 套用 migration(建表):
  npx prisma migrate dev
- 灌入 seed 資料(建立 admin 角色與 activity:manage 權限,選用):
  npx prisma db seed
  
- 啟動(watch 模式):
  pnpm start:dev
  
- 啟動成功後

  - API 根路徑:http://localhost:4000/api/v1
  - Swagger 文件:http://localhost:4000/docs
  - 本機測試登入(免 GitHub):
  curl -X POST http://localhost:4000/api/v1/auth/dev-login \
    -H "Content-Type: application/json" \
    -d '{"email":"you@example.com"}'
  - 會回一個 access_token,拿去當 Authorization: Bearer <token> 打需要權限的 API。