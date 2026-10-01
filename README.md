# 財富帝國 V19.9.42 WEB

這是《財富帝國》desktop / iPhone 網頁發布版。

## V19.9.42｜舊 Render Source 清除
本版針對 V19.9.41 實機截圖暴露的殘留舊 UI / ICON 做清理，不再以新版素材蓋在舊素材上。

- 主棋盤地產格不再繪製小房子 / 狀態 ICON；棋盤只保留名稱、價格 / 租金、所有權邊框與 LV 文字。
- 中央都會底部的裝飾小建築列已移除。
- 舊 v193 / v194 / v1990 中央都會銀行、租金保險、捷運、市政標案圖示 render layer 已停用。
- REV36 舊設施 image substitution 已停用。
- 城市委託保留 REV D01 新素材；其餘尚未有新版素材的設施先改為文字色塊，不回用舊 ICON。
- 公共建設：都會夜市、智慧科技塔、觀光碼頭、綠能公園的舊素材已退出目前實際 UI，改為「夜 / 科 / 港 / 綠」文字色塊。
- 都會銀行、租金保險、捷運、市政標案改成文字色塊。
- 手機快速操作四大入口改成純文字色塊，不再使用 Q04 / Q07 / Q03 舊 ICON。
- 手機底部導覽改成文字按鈕；Modal 開啟時導覽列隱藏，不再壓住視窗。
- Modal 左上角舊粉紅 X 圖片停用，改為純 CSS ×。
- 股票 / 即時事件標題與棋盤尺寸標示移除舊 ICON。
- C01 / D01 Asset Registry 仍保留，房產素材用於房產管理與升級流程；不再塞到棋盤格造成視覺雜訊。

## 驗證
- Inline JavaScript：15 段，syntax PASS。
- APP_BUILD_ID：19942。
- signaling / DataConnection / heartbeat / reconnect / resume / Host Reload Recovery 核心函式保留。
- USER VISUAL PASS：需正式 Pages 實機檢查後才能宣告。
- MULTIPLAYER UAT PASS：仍需兩裝置不同網路實測，Pages SUCCESS 不能取代。

## 安全回退
- `safe-rollback-v19.9.41`

## 下一步
先確認 V19.9.42 視覺殘留是否清乾淨；Visual PASS 後再按 Plan B 順序進策略道具 V1 / 市場操作深化，不先增加大型功能。
