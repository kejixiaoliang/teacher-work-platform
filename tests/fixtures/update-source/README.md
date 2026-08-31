# 本地 updater fixture

这些 fixture 只用于客户端状态测试，不是生产更新源，也不包含生产签名：

- `no-update.json`：清单版本与当前版本相同。
- `available.json`：清单版本高于当前版本，资源 URL 指向本地 fixture。
- `signature-error.json`：资源可访问，但签名内容故意无效。
- `missing-resource.json`：清单存在，安装包资源地址故意不存在。
- `offline.json`：记录断网场景；测试通过不启动 HTTP 服务来模拟。

真实发布时，`latest.json` 必须由 `generate-update-manifest.mjs` 生成，不能复制这些 fixture。
