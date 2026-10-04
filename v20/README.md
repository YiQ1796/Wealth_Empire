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

## Not yet claimed complete in V20

The following systems are intentionally **not** marked complete by Alpha 15:

- Full special-event behavior for all non-property tiles.
- Strategy-item inventory and proactive-use prompts.
- Live stock buying/selling and player stock positions.
- Multiplayer room synchronization, reload recovery and reconnect.
- Final mobile landscape visual acceptance.

Alpha 15 completes the single-player 44-grid property economy foundation first. Those systems must be completed and tested as separate end-to-end features rather than patched into this checkpoint.
