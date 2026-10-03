# Wealth Empire V20 Clean Rebuild

V20 is a clean rewrite. It does not patch or override the V19 monolithic index.html.

Rules:
- V19.9.64 remains untouched as rollback baseline.
- Every V20 release is a complete source checkpoint.
- If a release is wrong, revert to the previous checkpoint and rebuild that release.
- Do not add CSS or JavaScript override patches to hide defects.
- Board data, rules, UI, assets, multiplayer and market systems remain separate modules.
- New tile art replaces the complete tile visual source.
- Fixed tile names live inside the final tile PNG. Runtime overlays only dynamic data.

Phase 1:
- 36-tile 11x9 board
- 28 properties and 8 event tiles
- four corner event tiles
- contiguous 3/4 property groups
- center background asset slot
- complete-tile asset slots
- dice, movement, buy, rent and end-turn baseline
