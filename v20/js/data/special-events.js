export const CHANCE_EVENTS=Object.freeze([
  {id:"chance_bonus",name:"業外獎金",description:"臨時接到一筆業外獎金。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:1200}},
  {id:"chance_commission",name:"城市委託完成",description:"完成臨時城市委託，領取酬勞。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:900}},
  {id:"chance_shareholder",name:"股東禮金",description:"收到合作企業股東禮金。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:700}},
  {id:"chance_lottery",name:"商圈抽獎",description:"路過商圈抽獎意外中獎。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:1600}},
  {id:"chance_repair",name:"臨時維修",description:"資產臨時維修，支付小額費用。",rarity:"common",category:"cash_loss",effect:{kind:"cash",amount:-500}},
  {id:"chance_refund",name:"交通退款",description:"交通系統退回一筆費用。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:600}},
  {id:"chance_express",name:"快捷通車",description:"搭上快捷列車，向前移動 3 格。",rarity:"common",category:"move_forward",effect:{kind:"move",delta:3}},
  {id:"chance_ride",name:"朋友順風車",description:"朋友剛好路過，向前移動 2 格。",rarity:"common",category:"move_forward",effect:{kind:"move",delta:2}},
  {id:"chance_detour",name:"導航繞路",description:"導航帶錯路，往回移動 2 格。",rarity:"common",category:"move_back",effect:{kind:"move",delta:-2}},
  {id:"chance_wallet",name:"遺失錢包",description:"忙中出錯遺失一筆現金。",rarity:"common",category:"cash_loss",effect:{kind:"cash",amount:-700}},
  {id:"chance_claim",name:"保險理賠",description:"收到先前申請的保險理賠。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:1100}},
  {id:"chance_ticket",name:"停車罰單",description:"收到違規停車罰單。",rarity:"common",category:"cash_loss",effect:{kind:"cash",amount:-600}},
  {id:"chance_coupon",name:"城市消費券",description:"收到都會消費回饋。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:500}},
  {id:"chance_shortcut",name:"巷弄捷徑",description:"發現捷徑，向前移動 1 格。",rarity:"common",category:"move_forward",effect:{kind:"move",delta:1}},

  {id:"chance_rare_upgrade",name:"都市改建補助",description:"市府抽中你的建案，隨機一塊未滿級地產免費升級 1 級。",rarity:"rare",category:"property_upgrade",effect:{kind:"random_upgrade",fallbackAmount:1800}},
  {id:"chance_rare_permit",name:"黃金建案許可",description:"取得一張建案許可，可到「我的房產」指定一塊未滿級地產免費升級。",rarity:"rare",category:"property_permit",effect:{kind:"grant_permit",count:1}},
  {id:"chance_rare_guard",name:"產權保障獎",description:"取得一張產權保全券，可到「我的房產」指定保護一塊地產。",rarity:"rare",category:"property_guard",effect:{kind:"grant_property_protection",count:1}},
  {id:"chance_rare_jackpot",name:"城市超級獎金",description:"抽中年度城市獎金。",rarity:"rare",category:"cash_gain",effect:{kind:"cash",amount:3000}}
]);

export const FATE_EVENTS=Object.freeze([
  {id:"fate_patron",name:"貴人相助",description:"遇到貴人提供一筆資金。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:1500}},
  {id:"fate_expense",name:"意外支出",description:"突然出現一筆意外支出。",rarity:"common",category:"cash_loss",effect:{kind:"cash",amount:-1000}},
  {id:"fate_invoice",name:"中獎發票",description:"整理發票時發現中獎。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:800}},
  {id:"fate_phone",name:"手機摔壞",description:"手機意外摔壞，需要維修。",rarity:"common",category:"cash_loss",effect:{kind:"cash",amount:-700}},
  {id:"fate_blocked",name:"道路封閉",description:"前方施工封路，往回移動 3 格。",rarity:"common",category:"move_back",effect:{kind:"move",delta:-3}},
  {id:"fate_express",name:"搭上特快車",description:"幸運搭上特快車，向前移動 4 格。",rarity:"common",category:"move_forward",effect:{kind:"move",delta:4}},
  {id:"fate_redpacket",name:"意外紅包",description:"收到一筆意外紅包。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:1000}},
  {id:"fate_appliance",name:"家電故障",description:"家中設備故障，支付維修費。",rarity:"common",category:"cash_loss",effect:{kind:"cash",amount:-900}},
  {id:"fate_treasure",name:"路邊寶物",description:"意外發現可變現的寶物。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:1400}},
  {id:"fate_traffic",name:"嚴重塞車",description:"被塞車拖慢，往回移動 1 格。",rarity:"common",category:"move_back",effect:{kind:"move",delta:-1}},
  {id:"fate_shuttle",name:"免費接駁",description:"搭上免費接駁車，向前移動 2 格。",rarity:"common",category:"move_forward",effect:{kind:"move",delta:2}},
  {id:"fate_refund",name:"稅務退回",description:"收到一筆稅務退回款。",rarity:"common",category:"cash_gain",effect:{kind:"cash",amount:600}},
  {id:"fate_mistake",name:"帳單重複扣款",description:"銀行帳單發生重複扣款。",rarity:"common",category:"cash_loss",effect:{kind:"cash",amount:-550}},
  {id:"fate_greenlight",name:"一路綠燈",description:"一路暢行，向前移動 3 格。",rarity:"common",category:"move_forward",effect:{kind:"move",delta:3}},

  {id:"fate_rare_upgrade",name:"命運改建",description:"意外取得建築改善資格，隨機一塊未滿級地產免費升級 1 級。",rarity:"rare",category:"property_upgrade",effect:{kind:"random_upgrade",fallbackAmount:1600}},
  {id:"fate_rare_permit",name:"命運建案券",description:"取得一張建案許可，可到「我的房產」自由指定升級目標。",rarity:"rare",category:"property_permit",effect:{kind:"grant_permit",count:1}},
  {id:"fate_rare_guard",name:"命運保全令",description:"取得一張產權保全券，可到「我的房產」指定保護地產。",rarity:"rare",category:"property_guard",effect:{kind:"grant_property_protection",count:1}},
  {id:"fate_rare_windfall",name:"意外大進帳",description:"一筆多年未領取的資金突然入帳。",rarity:"rare",category:"cash_gain",effect:{kind:"cash",amount:2800}},
  {id:"fate_rare_loss",name:"重大意外支出",description:"突發事故造成一筆較大的臨時支出。",rarity:"rare",category:"cash_loss",effect:{kind:"cash",amount:-2200}}
]);

export const SPECIAL_EVENT_POOLS=Object.freeze({
  chance:CHANCE_EVENTS,
  fate:FATE_EVENTS
});
