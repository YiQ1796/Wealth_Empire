# 財富帝國 V19.9.25 WEB

這是《財富帝國》desktop / iPhone 網頁發布版。

## 本版
- 修正 Guest 自動重連時「程式自己關閉舊 DataConnection」又被誤判為新斷線，造成重連循環的核心問題。
- Guest 重連改成 single-flight：同時間只允許一個 reconnect 流程，舊 transport 先從全域引用脫鉤再 close/destroy。
- Heartbeat 由 5 秒 / 17 秒 stale 放寬為 7 秒 / 35 秒 stale；背景頁不主動拆線。
- 回到前景、視窗 focus、fullscreen 切換、pageshow、online 時改做有回應依據的健康檢查；不再先假裝收到活動。
- Host 對 Guest close 加入 6.5 秒 grace period；短暫連線抖動在期限內接回不寫 disconnect/reconnect 事件。
- 新增 Host Reload Recovery：房主重新整理時恢復原房號、完整遊戲 state、Guest resume tokens；原玩家可接回原座位。
- Host state 以節流方式存入 localStorage，beforeunload 再立即保存；有效期 12 小時。
- 若房主刷新時正處於需要計時器的小遊戲／拍賣，恢復後安全取消該即時活動並讓本回合重新操作，避免永久卡局。
- 保留 V19.9.24 的策略道具／市場操作與 V19.9.23 的新素材、都會三欄排版。
- safe-rollback-v19.9.24 已建立，可快速回退。
