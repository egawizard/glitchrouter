const {getAssets,getPrice,marketScore,cleanSymbol}=require("../lib/stocks");
function json(res,code,body){res.statusCode=code;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","public, s-maxage=12, stale-while-revalidate=15");res.end(JSON.stringify(body));}
const PREFERRED=["NVDA","AAPL","TSLA","MSFT","AMZN","META","GOOGL","QQQ","SPY","PLTR","COIN","AMD"];
module.exports=async function handler(req,res){
  if(req.method!=="GET")return json(res,405,{error:"METHOD_NOT_ALLOWED"});
  try{
    const assets=await getAssets();
    const by=new Map(assets.map(x=>[x.symbol,x]));
    let syms=String(req.query?.symbols||"").split(",").map(cleanSymbol).filter(Boolean);
    if(!syms.length)syms=PREFERRED.filter(s=>by.has(s));
    syms=[...new Set(syms)].filter(s=>by.has(s)).slice(0,12);
    const settled=await Promise.allSettled(syms.map(async symbol=>{
      const asset=by.get(symbol);const market=await getPrice(symbol,asset);
      return {...asset,market,marketQuality:marketScore(asset,market)};
    }));
    const items=[],errors=[];
    settled.forEach((x,i)=>x.status==="fulfilled"?items.push(x.value):errors.push({symbol:syms[i],error:x.reason?.message||"PRICE_FAILED"}));
    items.sort((a,b)=>(b.marketQuality?.score||0)-(a.marketQuality?.score||0));
    return json(res,200,{chainId:4663,items,errors,source:"ROBINHOOD_RHJ_PRICES_PLUS_MULTIPLIER",generatedAt:new Date().toISOString()});
  }catch(e){return json(res,502,{error:e.message||"STOCK_SCAN_FAILED"});}
};
