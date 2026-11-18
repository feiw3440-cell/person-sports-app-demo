# Zcode 下一轮续做任务（2026-11-19 更新）

> 全部为「需用户决策/授权」项，无自主推进项。代码内已占位标注。

## 产品决策项（等裁决后实施）
1. D-1 人气分口径（公式/权重）——当前服务端 formula 快照口径保持
2. 导师等级名称（认证/高级/体系）——页内「占位名·规则待确认」
3. 公开档案白名单细粒度（现 public/private 二态）
4. 积分体系（个人页「即将上线」）
5. 材料文件上传（evidence 文本口径，media_url 已预留）
6. content.reject 动作（服务端状态机无此动作，改契约需先授权）

## 生产化路径（需授权）
- JWT_SECRET 独立注入（启动日志已有警告）
- 容器化 / pm2（现为用户级 bat 脚本）
- HTTPS 域名部署、API 公网化

## 工程增强（可选）
- 完整测试框架（vitest；现 tools/api-smoke.mjs 冒烟 12 项）
- gh-pages 与 main 一键同步部署脚本整合（现手动 mock 构建 + ghp-deploy-api.mjs）

## 环境备忘
- 三服务：App 5173 / PC 5174 / API 8787（tools/start-all.bat / stop-all.bat）
- 冒烟：node tools/api-smoke.mjs（12/12）
- Pages：mock 展示版 561b57b（main 静态构建由 VITE_DATA_SOURCE=mock vite build --base=./ 产出）
