import{ITEM_DEFINITIONS}from"../data/items.js";
import{getItemUseStatus,inventoryCount,totalInventoryCount}from"../core/items.js";
import{UI_ASSETS}from"../data/ui-assets.js";

function escapeHtml(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function targetValue(option){
  if(option.kind==="tile")return"tile:"+option.value;
  if(option.kind==="stock")return"stock:"+option.value;
  return"value:"+option.value;
}

export function renderStrategyItems(state,player,{canControl=true}={}){
  const container=document.getElementById("itemInventoryList");
  if(!container||!player)return;

  const held=ITEM_DEFINITIONS
    .map(definition=>({
      definition,
      count:inventoryCount(player,definition.id),
      status:getItemUseStatus(state,player.seat,definition.id)
    }))
    .filter(entry=>entry.count>0);

  if(held.length===0){
    container.innerHTML=
      '<div class="empty-state empty-state--visual">'+
        '<img src="'+UI_ASSETS.modal.emptyData+'" alt="">'+
        '<span>目前尚未持有策略道具。可從機會、命運與後續特殊事件取得。</span>'+
      '</div>';
    return;
  }

  container.innerHTML=held.map(({definition,count,status})=>{
    const enabled=Boolean(canControl&&status.usable);
    const options=status.targets.map(option=>
      '<option value="'+escapeHtml(targetValue(option))+'">'+escapeHtml(option.label)+'</option>'
    ).join("");
    const rarityLabel=definition.rarity==="rare"?"稀有":"一般";
    return(
      '<article class="item-card '+(enabled?"is-usable":"is-locked")+'" data-item-card="'+escapeHtml(definition.id)+'">'+
        '<div class="item-card__head">'+
          '<div><strong>'+escapeHtml(definition.name)+'</strong><small>'+rarityLabel+'｜持有 ×'+count+'</small></div>'+
          '<span class="item-card__status">'+escapeHtml(enabled?"現在可使用":status.reason)+'</span>'+
        '</div>'+
        '<p>'+escapeHtml(definition.description)+'</p>'+
        '<div class="item-card__actions">'+
          '<select class="item-target-select" data-item-target="'+escapeHtml(definition.id)+'" '+(enabled?"":"disabled")+' aria-label="'+escapeHtml(definition.name)+'目標">'+
            options+
          '</select>'+
          '<button type="button" class="item-use-button" data-item-use="'+escapeHtml(definition.id)+'" '+(enabled?"":"disabled")+'>'+
            (enabled?"使用道具":"目前不可用")+
          '</button>'+
        '</div>'+
      '</article>'
    );
  }).join("");
}

export function itemUiSummary(state,player){
  const count=totalInventoryCount(player);
  const usable=ITEM_DEFINITIONS.filter(definition=>
    inventoryCount(player,definition.id)>0&&getItemUseStatus(state,player.seat,definition.id).usable
  );
  return{count,usable};
}
