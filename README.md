# 財富帝國 V19.9.40 WEB

這是《財富帝國》desktop / iPhone 網頁發布版。

## V19.9.40｜Plan B Phase 2 安全清理
- 角色技能維持永久移除：正式玩家 state 不再建立任何技能欄位。
- 新增 legacy role-skill state sanitizer：Host Reload Recovery、Host snapshot、Guest welcome/state 同步會丟棄舊 `skill / skills / characterSkill / roleSkill / avatarSkill` 類欄位，舊存檔可讀但不再繼續同步。
- Host 對舊客戶端殘留的 skill / ability action 明確拒絕，避免舊流程被重新啟動。
- 四大主操作仍只保留「擲骰子／我的房產／策略道具／市場操作」純文字色塊。
- 清除已無 DOM 使用的舊擲骰／房產主操作 sprite mapping 與舊 q-roll Q04 override；不再以舊 render source 疊新 UI。
- 「我的房產」仍是唯一房產管理入口；獨立「升級地產」不恢復。
- 玩家自由交易、轉盤、金幣雨、吃麵維持不可觸發；Host 拒絕舊 action 的保護保留。
- signaling、DataConnection、heartbeat、Guest reconnect、resume、Host Reload Recovery 核心函式未改動。

## 驗證狀態
- CODE / STATIC GATE：PASS（13 段 inline JavaScript syntax check、APP_BUILD_ID、主操作 render source、房產單一入口與 reconnect 核心存在性檢查）。
- DEPLOY：待 main 發布後確認。
- USER VISUAL PASS：尚未宣告。
- MULTIPLAYER UAT PASS：尚未宣告，仍需兩裝置不同網路實測。

## 後續 Plan B
- 清理已移除小遊戲與玩家交易的 legacy dead code／統計殘留。
- 策略道具 V1：主動詢問、拒絕不消耗、Host authoritative、事件紀錄與同步。
- 市場操作深化：持股、成本、現價、市值、未實現／已實現損益與冷卻／付費操作集中。
- 完成壟斷同步回歸後，再進股票 × 棋盤事件橋接、市場事件 state machine。
- 最後才做數據化經濟平衡與完整 Desktop / iPhone landscape / Multiplayer UAT。
