# nwueyes 前端

Vue 3 管理端，与 `../ruoyi` 后端配套使用。

**完整说明（项目介绍、数据库、Python、启动步骤）见 [../README.md](../README.md)。**

## 快速启动

```bash
npm install
npm run dev
```

- 开发代理：`/dev-api` → `http://localhost:8080`
- 默认账号：`admin` / `admin123`
- 生产构建：`npm run build:prod`（Nginx 托管 `dist/`，API 前缀 `/prod-api`）

## 主要页面

| 菜单 | 路径 |
|------|------|
| 监控大屏 | 拉流预览 + RTSP/FLV 识别模式 + 开始/停止识别 |
| 数据看板 | 停留记录、人员档案、陌生人研判 |
| 行为日志 | 进/出门流水（只读） |
| 视频测试 | 上传 MP4 + YOLO 分析 |

业务规则与后端一致见 [`../README.md`](../README.md) 或后端 `NWUEYES_README.md`。
