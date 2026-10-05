# Wealth Empire V20 Clean Rebuild

V20 is a clean rewrite. It does not patch or override the V19 monolithic `index.html`.

## Core rules

- V19.9.64 remains untouched as a rollback baseline.
- Every V20 release is a complete source checkpoint.
- If a release is wrong, revert to the previous checkpoint and rebuild that release.
- Do not add CSS or JavaScript override patches to hide defects.
- Board data, rules, UI, assets, multiplayer and market systems remain separate modules.
- New tile art replaces the complete tile visual source; do not stack a new icon over an old tile source.

## Alpha 15 — 44-tile property economy loop

Alpha 15 replaces the temporary 36-tile V20 board model with the approved 44-tile property layout.

- Perimeter layout: 13 top / 9 right / 13 bottom / 9 left = 44 tiles.
- 24 purchasable properties.
- 8 property regions × 3 properties per region.
- Passing Start awards $2,500.
- Owning all 3 properties in one region permanently adds 25% to rent for that region.
- Property upgrades are integrated into **My Properties**; there is no standalone Upgrade Property entry.
- Maximum property level is LV.2.
- Each upgrade costs 50% of the base property price.
- Level rent multiplier remains centralized in the economy module.
- My Properties now shows region completion, asset value, current rent, upgrade controls, cumulative rent received/paid and recent rent records.

### Property regions

1. 海港區：星港住宅、海灣公寓、水岸別墅
2. 商業區：翡翠商圈、黃金商圈、百貨商場
3. 科技區：科技園區、創新園區、雲端科技城
4. 住宅區：北城豪宅、綠能園區、湖畔豪宅
5. 金融區：金融大道、商務中心、晶鑽商業區
6. 觀光區：影城、國際飯店、頂級飯店
7. 豪宅區：山景莊園、天空豪宅、奢華莊園
8. 帝王區：皇后大道、帝王商圈、世界中心

## Visual source rule

Alpha 14 supplied 36 complete-tile visual assets whose fixed names are already drawn inside each image. After switching to 44 tiles, numeric tile-number mapping is no longer safe.

Alpha 15 therefore reuses a previous full-tile image only when both conditions are true:

1. The tile name matches exactly.
2. The old image orientation matches the new tile position.

If either condition fails, the tile uses one clean text fallback source. This avoids stretching a wrong old full-tile image or stacking a new label over an obsolete visual source. New 44-tile artwork can replace these fallbacks later without changing the property rules.

## Verification

Automated V20 checks cover:

- 44 total board tiles.
- 24 purchasable properties.
- 8 regions with exactly 3 properties each.
- No duplicate board grid coordinates.
- Region completion after buying all 3 properties.
- 25% completed-region rent bonus.
- Upgrade cost at 50% of property base price.
- Maximum LV.2 enforcement.
- Rent transfer and cumulative paid/received accounting.
- JavaScript module syntax.


## Alpha 16 — gameplay systems complete checkpoint

Alpha 16 completes the current requested gameplay systems as end-to-end features instead of temporary prototypes.

### Replacement minigames

All legacy minigame execution is retired. The former high-low and horse triggers now enter one shared six-game challenge pool:

1. 都會快遞戰 — reaction / lane decision.
2. 金庫解鎖 — timing / precision.
3. 摩天樓疊樓戰 — spatial precision.
4. 商業記憶戰 — memory sequence.
5. 城市路線規劃 — route-cost planning.
6. 商圈選址戰 — multi-factor investment judgment.

Rules:

- Every active player participates.
- AI players submit results through the same minigame lifecycle.
- Human players play locally and submit a score to the host.
- The last three minigames are excluded from the next random draw when possible.
- Every rank receives a reward; higher ranks receive more.
- Minigame state is host-authoritative and is included in room snapshots.

### AI players

- Single-player starts with one human and three AI players.
- Multiplayer rooms keep empty seats as AI and replace those seats when friends join before the game starts.
- AI decisions use cash reserves, region completion value, property upgrade value and stock trend/value signals.
- AI profiles are balanced, cautious and aggressive.
- Disconnected human seats are reserved for 20 seconds for reload/reconnect before AI takeover.
- AI minigame results use deterministic seeded behavior and do not read hidden human inputs.

### Multiplayer / reconnect

- Six-digit temporary room codes.
- Host-authoritative game state.
- WSS/MQTT relay is the primary transport for cross-network/mobile reliability.
- PeerJS/WebRTC is kept as fallback transport.
- Host state is persisted locally and restored after refresh.
- Guest client identity and seat are persisted locally and rejoin the same seat after refresh.
- A disconnected seat is not immediately destroyed; the reconnect grace window prevents accidental refresh from creating a new player.

### Stock market

- All 10 stocks move every ROUND.
- Every stock stores previous price, current price, round change and rolling history.
- Price movement combines volatility, macro movement, momentum and mean reversion.
- Every stock is forced to move at least one price unit each round, including price-boundary handling.
- Players can freely buy and sell quantities during their own turn.
- Holdings track shares, average cost, current value, unrealized P/L and realized P/L.
- AI players can also buy and sell using the same market state and cash rules.
- ROUND transition advances the market exactly once.

### UI behavior

- 股票 / 我的房產 / 道具 / 資訊 are shortcut buttons that open independent modal windows instead of compressing the right-side HUD.
- Multiplayer setup has its own room dialog.
- Minigames run in their own modal and show all four participants plus final rankings.

## Alpha 16 verification

Deployment is gated by both existing property-economy tests and the new gameplay-systems test suite. The new checks cover:

- Offline human seat remains active.
- Three AI seats are created correctly.
- Every stock changes each round.
- Buy/sell accounting and turn ownership.
- AI property-set completion behavior.
- AI property upgrade selection.
- Minigame AI filling, human submission, four-player ranking and rewards.
- Six-digit room-code validation and remote-action validation.
- Market advances exactly once on round transition.
- Round 30 ends the game instead of looping forever.
- Legacy high-low trigger enters the replacement minigame pool.

## Still outside Alpha 16

The following are intentionally separate requested systems, not partial Alpha 16 implementations:

- Remaining non-minigame special-event gameplay.
- Strategy-item inventory and proactive-use rules.
- Final V5 art replacement, houses, character animation assets and central five-function artwork, which will be integrated only after the user supplies the complete asset batches.

The V5 visual replacement must remove the old render source first. New art must never be stacked over old tile or icon sources.
