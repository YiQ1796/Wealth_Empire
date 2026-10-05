export const STOCK_DEFINITIONS=Object.freeze([
  {id:"TECH",name:"星辰科技",basePrice:117,volatility:0.075,sector:"科技"},
  {id:"LAND",name:"聯城地產",basePrice:100,volatility:0.055,sector:"地產"},
  {id:"SHIP",name:"海港運輸",basePrice:73,volatility:0.065,sector:"運輸"},
  {id:"ENER",name:"恆光能源",basePrice:88,volatility:0.060,sector:"能源"},
  {id:"BANK",name:"銀河金融",basePrice:117,volatility:0.050,sector:"金融"},
  {id:"FUN",name:"樂園娛樂",basePrice:63,volatility:0.085,sector:"娛樂"},
  {id:"CHIP",name:"天晶半導體",basePrice:174,volatility:0.095,sector:"半導體"},
  {id:"BIO",name:"新紀生技",basePrice:74,volatility:0.105,sector:"生技"},
  {id:"FOOD",name:"豐盛食品",basePrice:52,volatility:0.040,sector:"民生"},
  {id:"RETL",name:"都會零售",basePrice:68,volatility:0.055,sector:"零售"}
]);

export const STOCK_BY_ID=Object.freeze(
  Object.fromEntries(STOCK_DEFINITIONS.map(stock=>[stock.id,stock]))
);
