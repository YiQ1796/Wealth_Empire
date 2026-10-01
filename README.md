# 財富帝國 V19.9.41 WEB

這是《財富帝國》desktop / iPhone 網頁發布版。

## V19.9.41｜REV C01 / D01 新素材正式替換
- 整合使用者提供的 REV C01 Batch 04 + REV D01 Batch 05，共 20 張素材，統一成單一 5×4 Asset Registry render source。
- 地產視覺正式替換：空地、可購買、已持有、抵押、升級中，以及 Lv.0 / Lv.1 / Lv.2 房屋皆改用 C01 新素材。
- 棋盤 P1～P4 棋子正式改用 C01 / D01 新素材；目前玩家高亮改用 D01 專用 highlight，不再使用舊手繪光圈。
- 棋盤事件正式替換：起點、機會、命運、稅務、地產拍賣、股市事件改由 D01 單一 authority render。
- 城市委託改用 D01 委託素材；舊 v193 / v194 / v1990 / REV36 中央委託疊圖來源已停用，避免新舊素材同時 Render。
- 地產升級策略道具詢問加入 C01「升級中」視覺，與既有免費建築許可流程整合。
- 四大主操作仍維持「擲骰子／我的房產／策略道具／市場操作」純文字色塊；本批素材不拿來恢復主操作 ICON。
- 棋盤角度不變；獨立「升級地產」、玩家自由交易、角色技能、轉盤／金幣雨／吃麵均不恢復。
- signaling、DataConnection、heartbeat、Guest reconnect、resume、Host Reload Recovery 核心函式未修改。

## Asset Registry
- Source: `assets/v19941/rev_c01_d01_all20_v1.webp`
- Grid: 5 columns × 4 rows
- Property: vacant / purchasable / owned / mortgaged / upgrading / Lv.0 / Lv.1 / Lv.2
- Pawns: P1 / P2 / P3 / P4 / current-player highlight
- Board / City: chance / fate / tax / auction / stock / commission / start

## 驗證狀態
- CODE / STATIC GATE：PASS。
- Inline JavaScript syntax：PASS。
- 舊 Q07 board source：不再引用。
- 舊 Q05 board pawn source：不再引用（角色選擇／頭像用 Q05 portrait UI 保留，因其不是棋盤棋子 render source）。
- 舊中央城市委託 canvas 疊圖：已停用。
- signaling / reconnect / Host Reload Recovery 關鍵函式：存在且未移除。
- DEPLOY：待 main 發布後確認。
- USER VISUAL PASS：需正式頁面實機確認後才能宣告。
- MULTIPLAYER UAT PASS：仍需兩裝置不同網路實測，不能由 Pages SUCCESS 代替。

## 下一步 Plan B
- 清理已移除的轉盤／金幣雨／吃麵與玩家交易 legacy dead code／統計殘留。
- 完成策略道具 V1：主動詢問、可拒絕且不消耗、Host authoritative、同步與事件紀錄。
- 市場操作深化後，再依順序進入股票 × 棋盤、市場事件與數據化經濟平衡。
