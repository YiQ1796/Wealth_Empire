from pathlib import Path
import re

INDEX = Path("index.html")
README = Path("README.md")

html = INDEX.read_text(encoding="utf-8")
before = html

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

network_markers = [
    "DataConnection",
    "heartbeat",
    "reconnect",
    "resume",
    "Host Reload Recovery",
]
network_counts_before = {m: before.count(m) for m in network_markers}
stock_markers = [
    'art("stockBuy","rev36-stock-action-art")',
    'art("stockSell","rev36-stock-action-art")',
]
stock_counts_before = {m: before.count(m) for m in stock_markers}

html = replace_once(
    html,
    '<title>財富帝國 V19.9.47 WEB｜股票買賣圖示恢復版</title>',
    '<title>財富帝國 V19.9.48 WEB｜棋盤 Full-Tile 第一版</title>',
    "page title",
)
html = replace_once(
    html,
    '<meta name="description" content="財富帝國 V19.9.47 WEB - 恢復既有新版股票買進/賣出圖示，保留 V19.9.46 其他內容">',
    '<meta name="description" content="財富帝國 V19.9.48 WEB - A15-A20 棋盤特殊格改為標題在上、主圖在下的 Full-Tile render；保留 REV36 股票買賣新版素材">',
    "meta description",
)
html = replace_once(
    html,
    '📱 財富帝國 V19.9.47 WEB｜股票買賣圖示恢復｜56格大地圖',
    '📱 財富帝國 V19.9.48 WEB｜棋盤 Full-Tile｜56格大地圖',
    "top title",
)
html = replace_once(
    html,
    'const APP_BUILD_ID="19947";',
    'const APP_BUILD_ID="19948";',
    "APP_BUILD_ID",
)

html, lobby_count = re.subn(
    r'BUILD 19\.9\.\d+',
    'BUILD 19.9.48',
    html,
    count=1,
)
if lobby_count != 1:
    raise SystemExit(f"lobby build label: expected exactly 1 match, found {lobby_count}")

helper_anchor = """function drawV19944TileIcon(type,x,y,w,h){
  const map={start:15,chance:16,fate:17,tax:18,auction:19,stock:20};
  return drawV19944CanvasAsset(map[type],x,y,w,h);
}
"""
helper_new = helper_anchor + """
/* V19.9.48 BOARD_TILE renderer.
   A15-A20 are rendered as the tile's main visual instead of a small icon.
   The source cell is center-cropped to cover the full artwork region without changing board geometry. */
function drawV19948FullTileArt(type,x,y,w,h){
  const map={start:15,chance:16,fate:17,tax:18,auction:19,stock:20};
  const cell=v19944SpriteCell(map[type]);
  if(!cell||!cell.image.complete||!cell.image.naturalWidth||w<=0||h<=0)return false;

  const cellW=cell.image.naturalWidth/5;
  const cellH=cell.image.naturalHeight/2;
  let sx=cell.col*cellW,sy=cell.row*cellH,sw=cellW,sh=cellH;
  const sourceRatio=cellW/cellH;
  const targetRatio=w/h;

  if(sourceRatio>targetRatio){
    sw=cellH*targetRatio;
    sx=cell.col*cellW+(cellW-sw)/2;
  }else if(sourceRatio<targetRatio){
    sh=cellW/targetRatio;
    sy=cell.row*cellH+(cellH-sh)/2;
  }

  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(cell.image,sx,sy,sw,sh,x,y,w,h);
  ctx.restore();
  return true;
}
"""
html = replace_once(html, helper_anchor, helper_new, "full-tile helper insertion")

old_tile_block = """    ctx.fillStyle=base;ctx.strokeStyle="#7890a7";ctx.lineWidth=2;rr(x-w/2+1,y-h/2+1,w-2,h-2,phone?6:9,true,true);ctx.restore();
    const artSize=phone?Math.min(42,Math.max(30,Math.min(w,h)*.50)):Math.min(34,Math.max(24,Math.min(w,h)*.42));
    if(phone){
      drawV19944TileIcon(t.type,x-artSize/2,y-h*.16-artSize/2,artSize,artSize);
      ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font='1000 22px "Microsoft JhengHei","Noto Sans TC",sans-serif';
      ctx.fillText(compactTileName(t.name),x,y+h*.23,w-8)
    }else{
      drawV19944TileIcon(t.type,x-w/2+7,y-h/2+8,artSize,artSize);
      ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="alphabetic";
      ctx.font='1000 14px "Microsoft JhengHei"';ctx.fillText(t.name,x+8,y+5,w-38)
    }
"""
new_tile_block = """    const tileX=x-w/2+1,tileY=y-h/2+1,tileW=w-2,tileH=h-2;
    const titleH=phone?Math.max(20,Math.min(30,tileH*.28)):Math.max(14,Math.min(20,tileH*.30));
    const radius=phone?6:9;

    /* Neutral fallback only; the A15-A20 artwork is now the dominant render source. */
    ctx.fillStyle="#eef3f8";ctx.strokeStyle="rgba(70,96,126,.48)";ctx.lineWidth=1.5;
    rr(tileX,tileY,tileW,tileH,radius,true,true);ctx.restore();

    ctx.save();
    ctx.beginPath();ctx.roundRect(tileX,tileY,tileW,tileH,radius);ctx.clip();
    const artY=tileY+titleH,artH=Math.max(1,tileH-titleH);
    if(!drawV19948FullTileArt(t.type,tileX,artY,tileW,artH)){
      ctx.fillStyle=base;ctx.fillRect(tileX,artY,tileW,artH);
    }
    ctx.fillStyle="rgba(248,251,255,.96)";
    ctx.fillRect(tileX,tileY,tileW,titleH);
    ctx.restore();

    ctx.save();
    ctx.beginPath();ctx.roundRect(tileX+.5,tileY+.5,tileW-1,tileH-1,radius);
    ctx.strokeStyle="rgba(55,82,112,.62)";ctx.lineWidth=1.25;ctx.stroke();
    ctx.fillStyle="#18324f";ctx.textAlign="center";ctx.textBaseline="middle";
    const tileLabel=phone?compactTileName(t.name):t.name;
    const titleFont=phone?Math.max(14,Math.min(20,titleH*.68)):Math.max(10,Math.min(14,titleH*.72));
    ctx.font='1000 '+titleFont+'px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    ctx.fillText(tileLabel,x,tileY+titleH/2,tileW-8);
    ctx.restore();
"""
html = replace_once(html, old_tile_block, new_tile_block, "A15-A20 event tile render block")

# Guard against reintroducing the rejected small-icon render path.
if "const artSize=phone?Math.min(42" in html:
    raise SystemExit("Rejected small-icon tile render path still present")
if "drawV19944TileIcon(t.type,x-artSize/2" in html or "drawV19944TileIcon(t.type,x-w/2+7" in html:
    raise SystemExit("Rejected A15-A20 small-icon calls still present")

# The stock REV36 artwork restored in V19.9.47 must remain untouched.
for marker, count_before in stock_counts_before.items():
    count_after = html.count(marker)
    if count_after != count_before or count_after < 1:
        raise SystemExit(f"stock artwork marker changed: {marker} before={count_before} after={count_after}")

# Multiplayer/reconnect markers must be untouched by this visual-only patch.
for marker, count_before in network_counts_before.items():
    count_after = html.count(marker)
    if count_after != count_before:
        raise SystemExit(f"network marker changed: {marker} before={count_before} after={count_after}")

if len(html.encode("utf-8")) < 1_500_000:
    raise SystemExit("index.html unexpectedly shrank below 1.5 MB; aborting to prevent truncation regression")

INDEX.write_text(html, encoding="utf-8")

readme = README.read_text(encoding="utf-8")
readme = replace_once(readme, "# 財富帝國 V19.9.47 WEB", "# 財富帝國 V19.9.48 WEB", "README heading")
intro_anchor = "這是《財富帝國》desktop / iPhone 網頁發布版。\n"
release_notes = """

## V19.9.48｜A15–A20 棋盤 Full-Tile Render 第一版
本版只處理目前最高優先的棋盤 Tile 視覺模型，不改棋盤角度、路線或多人連線。A15–A20（起點／機會／命運／稅務局／地產拍賣行／股市事件）不再以小 icon 塞進舊格框，而是改成「標題在上、主圖在下、主圖佔據整個剩餘格面」的 Full-Tile render。配色保持中性，不照抄示意圖，後續仍以使用者最終視覺決定為準。

- A15–A20：移除 20–40px 小 icon render path，改用大面積主圖。
- Board geometry：56 格路線、角度、座標與事件邏輯不變。
- 股票：保留 V19.9.47 已恢復的 REV36 stockBuy / stockSell 新版圖示，舊 Q02 仍停用。
- Multiplayer：signaling、DataConnection、heartbeat、reconnect、resume、Host Reload Recovery 不修改。
- USER VISUAL PASS：仍需 Desktop + iPhone landscape 正式頁實機檢查後才能宣告。

"""
if "## V19.9.48｜A15–A20 棋盤 Full-Tile Render 第一版" not in readme:
    readme = replace_once(readme, intro_anchor, intro_anchor + release_notes, "README release insertion")
readme = readme.replace("APP_BUILD_ID：19947。", "APP_BUILD_ID：19948。", 1)
readme = readme.replace(
    "先驗 V19.9.46 正式頁面的 A01–A20、iPhone 都會核心 2×3 與公共建設 2×2；Visual PASS 後再進下一批素材與 legacy dead-code audit。",
    "先驗 V19.9.48 正式頁 A15–A20 Full-Tile（Desktop + iPhone landscape），再依序提高 A11–A14 與 A05–A10 主圖比例；Visual PASS 前不宣告完成。",
    1,
)
README.write_text(readme, encoding="utf-8")

print("V19.9.48 patch prepared")
print("index bytes:", len(html.encode("utf-8")))
print("network marker counts:", network_counts_before)
print("stock marker counts:", stock_counts_before)
