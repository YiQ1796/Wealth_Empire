# 財富帝國 V19.9.8 WEB

這是《財富帝國》iPhone / desktop 網頁發布版。

- 本版只修手機右側骰子資訊區；V19.9.7 其他版面維持不變
- 根因：歷史 `html body .controls ... !important` 規則 specificity 高於 V19.9.7 手機骰子 selector
- 修正：最終手機 Authority 使用 `html body.phone-landscape .controls ...`，權重高於歷史規則
- 預期畫面：兩顆骰子在上方；玩家擲骰狀態與總點數在下方完整寬度
- 手機快速操作維持 2 × 2；都會核心維持 2 × 3
- NEW BATCH04 / NEW BATCH05 仍未正式整合

目前 V19.9.8 為 iPhone 橫向骰子區 UAT 候選版；尚未宣告實機 PASS。
