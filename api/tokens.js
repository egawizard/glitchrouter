const CHAIN_ID = 4663;
const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function json(res,code,body){
  res.statusCode=code;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=1800");
  res.end(JSON.stringify(body));
}
function addr(v){return /^0x[a-fA-F0-9]{40}$/.test(v||"");}
function normalizeToken(t){
  if(!t || typeof t!=="object") return null;
  const address=String(t.address||"");
  if(!addr(address) && address.toLowerCase()!==NATIVE) return null;
  const decimals=Number(t.decimals);
  if(!Number.isInteger(decimals)||decimals<0||decimals>255) return null;
  return {
    address,
    chainId:CHAIN_ID,
    symbol:String(t.symbol||"TOKEN").slice(0,32),
    name:String(t.name||t.symbol||"Token").slice(0,96),
    decimals,
    logoURI:t.logoURI||t.logoUrl||null,
    priceUSD:t.priceUSD!=null?String(t.priceUSD):null
  };
}
module.exports=async function handler(req,res){
  if(req.method!=="GET") return json(res,405,{error:"METHOD_NOT_ALLOWED"});
  try{
    const headers={accept:"application/json"};
    if(process.env.LIFI_API_KEY) headers["x-lifi-api-key"]=process.env.LIFI_API_KEY;
    const r=await fetch(`https://li.quest/v1/tokens?chains=${CHAIN_ID}`,{headers});
    const body=await r.json();
    if(!r.ok) throw new Error(body?.message||body?.error||`LI.FI HTTP ${r.status}`);

    let raw=[];
    if(Array.isArray(body)) raw=body;
    else if(Array.isArray(body.tokens)) raw=body.tokens;
    else if(body.tokens && typeof body.tokens==="object"){
      raw=body.tokens[String(CHAIN_ID)]||body.tokens[CHAIN_ID]||Object.values(body.tokens).flat();
    }

    const seen=new Set();
    const tokens=raw.map(normalizeToken).filter(Boolean).filter(t=>{
      const k=t.address.toLowerCase();
      if(seen.has(k)) return false; seen.add(k); return true;
    }).sort((a,b)=>{
      const pa=Number(a.priceUSD||0)>0?0:1, pb=Number(b.priceUSD||0)>0?0:1;
      if(pa!==pb) return pa-pb;
      return a.symbol.localeCompare(b.symbol);
    });

    return json(res,200,{chainId:CHAIN_ID,count:tokens.length,tokens,source:"LI.FI token catalog"});
  }catch(e){
    return json(res,502,{error:e.message||"TOKEN_CATALOG_FAILED",tokens:[]});
  }
};