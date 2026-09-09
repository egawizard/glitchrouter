const {getSnapshot,cleanSymbol}=require("../lib/stocks");
function json(res,code,body){res.statusCode=code;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","public, s-maxage=12, stale-while-revalidate=15");res.end(JSON.stringify(body));}
module.exports=async function handler(req,res){
  if(req.method!=="GET")return json(res,405,{error:"METHOD_NOT_ALLOWED"});
  const symbol=cleanSymbol(req.query?.symbol);if(!symbol)return json(res,400,{error:"INVALID_SYMBOL"});
  try{return json(res,200,{item:await getSnapshot(symbol),source:"ROBINHOOD_RHJ_PRICES_PLUS_MULTIPLIER"});}
  catch(e){return json(res,502,{error:e.message||"STOCK_DETAIL_FAILED"});}
};
