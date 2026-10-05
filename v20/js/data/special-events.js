export const CHANCE_EVENTS=Object.freeze([
  {id:"chance_bonus",name:"業外獎金",description:"臨時接到一筆業外獎金。",effect:{kind:"cash",amount:1200}},
  {id:"chance_commission",name:"城市委託完成",description:"完成臨時城市委託，領取酬勞。",effect:{kind:"cash",amount:900}},
  {id:"chance_shareholder",name:"股東禮金",description:"收到合作企業股東禮金。",effect:{kind:"cash",amount:700}},
  {id:"chance_lottery",name:"商圈抽獎",description:"路過商圈抽獎意外中獎。",effect:{kind:"cash",amount:1600}},
  {id:"chance_repair",name:"臨時維修",description:"資產臨時維修，支付小額費用。",effect:{kind:"cash",amount:-500}},
  {id:"chance_refund",name:"交通退款",description:"交通系統退回一筆費用。",effect:{kind:"cash",amount:600}},
  {id:"chance_express",name:"快捷通車",description:"搭上快捷列車，向前移動 3 格。",effect:{kind:"move",delta:3}},
  {id:"chance_ride",name:"朋友順風車",description:"朋友剛好路過，向前移動 2 格。",effect:{kind:"move",delta:2}},
  {id:"chance_detour",name:"導航繞路",description:"導航帶錯路，往回移動 2 格。",effect:{kind:"move",delta:-2}},
  {id:"chance_wallet",name:"遺失錢包",description:"忙中出錯遺失一筆現金。",effect:{kind:"cash",amount:-700}},
  {id:"chance_claim",name:"保險理賠",description:"收到先前申請的保險理賠。",effect:{kind:"cash",amount:1100}},
  {id:"chance_ticket",name:"停車罰單",description:"收到違規停車罰單。",effect:{kind:"cash",amount:-600}}
]);

export const FATE_EVENTS=Object.freeze([
  {id:"fate_patron",name:"貴人相助",description:"遇到貴人提供一筆資金。",effect:{kind:"cash",amount:1500}},
  {id:"fate_expense",name:"意外支出",description:"突然出現一筆意外支出。",effect:{kind:"cash",amount:-1000}},
  {id:"fate_invoice",name:"中獎發票",description:"整理發票時發現中獎。",effect:{kind:"cash",amount:800}},
  {id:"fate_phone",name:"手機摔壞",description:"手機意外摔壞，需要維修。",effect:{kind:"cash",amount:-700}},
  {id:"fate_blocked",name:"道路封閉",description:"前方施工封路，往回移動 3 格。",effect:{kind:"move",delta:-3}},
  {id:"fate_express",name:"搭上特快車",description:"幸運搭上特快車，向前移動 4 格。",effect:{kind:"move",delta:4}},
  {id:"fate_redpacket",name:"意外紅包",description:"收到一筆意外紅包。",effect:{kind:"cash",amount:1000}},
  {id:"fate_appliance",name:"家電故障",description:"家中設備故障，支付維修費。",effect:{kind:"cash",amount:-900}},
  {id:"fate_treasure",name:"路邊寶物",description:"意外發現可變現的寶物。",effect:{kind:"cash",amount:1400}},
  {id:"fate_traffic",name:"嚴重塞車",description:"被塞車拖慢，往回移動 1 格。",effect:{kind:"move",delta:-1}},
  {id:"fate_shuttle",name:"免費接駁",description:"搭上免費接駁車，向前移動 2 格。",effect:{kind:"move",delta:2}},
  {id:"fate_refund",name:"稅務退回",description:"收到一筆稅務退回款。",effect:{kind:"cash",amount:600}}
]);

export const SPECIAL_EVENT_POOLS=Object.freeze({
  chance:CHANCE_EVENTS,
  fate:FATE_EVENTS
});
