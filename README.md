# 財富帝國 V19.9.14 WEB

這是《財富帝國》desktop / iPhone 網頁發布版。

## 本版
- NEW BATCH06 UI10 正式進 main，使用單一 WebP sprite 降低下載量。
- Batch06 10 張素材已對應：拍賣、大額損失、大額獲利、倒數、事件、多人小遊戲、勝利/豪華 Popup、股票、交易、地產升級。
- 好友房建立後，「分享房號」會等到 Peer signaling 真正 open 才啟用，避免房號尚未註冊就先分享。
- 初次加入遇到 peer-unavailable / network / socket / server / webrtc 類暫時錯誤會自動重試，不再第一次就直接失敗。
- 大廳 BUILD 顯示同步更新為 19.9.14。
- STUN 候選擴充至 Google stun / stun1 / stun2 / stun3。
- V19.9.13 桌機銀行橫向版、V19.9.12 手機功能面板、V19.9.11 Bonus 結果層、V19.9.8 骰子資訊全部保留。
- NEW BATCH04 / NEW BATCH05 仍未正式整合。

## 尚待實機驗證
- 兩支 iPhone Safari 不同網路建立 / 加入好友房。
- 若 signaling 已成功、但後續 WebRTC 仍因行動網路 NAT 失敗，需要再加入 TURN relay；本版沒有硬塞公開 TURN 帳密。

正式頁面使用 APP_BUILD_ID 19914。
