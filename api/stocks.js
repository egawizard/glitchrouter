const {getAssets}=require("../lib/stocks");
function json(res,code,body){res.statusCode=code;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=900");res.end(JSON.stringify(body));}
module.exports=async function handler(req,res){
  if(req.method!=="GET")return json(res,405,{error:"METHOD_NOT_ALLOWED"});
  try{
    const assets=await getAssets();
    return json(res,200,{chainId:4663,count:assets.length,assets,source:"ROBINHOOD_RHJ_ASSET_REGISTRY",generatedAt:new Date().toISOString()});
  }catch(e){return json(res,502,{error:e.message||"STOCK_REGISTRY_FAILED"});}
};
