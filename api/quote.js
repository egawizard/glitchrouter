const CHAIN_ID = 4663;
const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function addressOk(v){ return /^0x[a-fA-F0-9]{40}$/.test(v || ""); }
function json(res, code, body){
  res.statusCode = code;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.end(JSON.stringify(body));
}
function errorText(body,status){
  if(!body) return `HTTP ${status}`;
  if(typeof body === "string") return body.slice(0,220);
  return body.message || body.error || body.description || body.code || `HTTP ${status}`;
}
async function fetchJson(url, opts={}, timeoutMs=12000){
  const c = new AbortController();
  const timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(url,{...opts,signal:c.signal});
    const text=await r.text();
    let body; try{body=JSON.parse(text)}catch{body=text}
    if(!r.ok) throw new Error(errorText(body,r.status));
    return body;
  }finally{clearTimeout(timer)}
}
function safeTx(tx){
  if(!tx || !addressOk(tx.to) || !/^0x[0-9a-fA-F]*$/.test(tx.data||"0x")) return null;
  return {
    to:tx.to,
    data:tx.data||"0x",
    value:tx.value||"0x0",
    gas:tx.gas||tx.gasLimit||null,
    gasPrice:tx.gasPrice||null
  };
}
function sumUsd(items){
  const n=(items||[]).reduce((s,x)=>s+(Number(x?.amountUSD)||0),0);
  return Number.isFinite(n)&&n>0 ? n.toString() : null;
}

async function getLifi({sellToken,buyToken,sellAmount,taker,slippageBps}){
  const p=new URLSearchParams({
    fromChain:String(CHAIN_ID),toChain:String(CHAIN_ID),
    fromToken:sellToken,toToken:buyToken,fromAmount:sellAmount,
    fromAddress:taker,toAddress:taker,slippage:String(Number(slippageBps)/10000)
  });
  const headers={accept:"application/json"};
  if(process.env.LIFI_API_KEY) headers["x-lifi-api-key"]=process.env.LIFI_API_KEY;
  const q=await fetchJson(`https://li.quest/v1/quote?${p}`,{headers});
  const tx=safeTx(q.transactionRequest);
  if(!tx || !q?.estimate?.toAmount) throw new Error("LI.FI returned no executable route");
  const steps=(q.includedSteps||[]).map(x=>x.tool).filter(Boolean);
  const route=[q.tool,...steps].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(" → ");
  return {
    provider:"lifi",label:"LI.FI",
    buyAmount:String(q.estimate.toAmount),
    minBuyAmount:q.estimate.toAmountMin ? String(q.estimate.toAmountMin) : null,
    approvalSpender:addressOk(q.estimate.approvalAddress)?q.estimate.approvalAddress:null,
    gasUsd:sumUsd(q.estimate.gasCosts),providerFeeUsd:sumUsd(q.estimate.feeCosts),
    route:route || "LI.FI SMART ROUTE",transaction:tx
  };
}

async function getZeroX({sellToken,buyToken,sellAmount,taker,slippageBps}){
  if(!process.env.ZEROX_API_KEY) throw new Error("ZEROX_API_KEY not configured");
  const p=new URLSearchParams({
    chainId:String(CHAIN_ID),sellToken,buyToken,sellAmount,taker,
    slippageBps:String(slippageBps)
  });
  const q=await fetchJson(`https://api.0x.org/swap/allowance-holder/quote?${p}`,{
    headers:{"0x-api-key":process.env.ZEROX_API_KEY,"0x-version":"v2",accept:"application/json"}
  });
  if(q.liquidityAvailable===false) throw new Error("No 0x liquidity");
  const tx=safeTx(q.transaction);
  if(!tx || !q.buyAmount) throw new Error("0x returned no executable route");
  const fills=(q.route?.fills||[]).map(x=>x.source).filter(Boolean);
  const route=fills.length?[...new Set(fills)].slice(0,4).join(" + "):"0x SMART ORDER ROUTER";
  return {
    provider:"0x",label:"0x",
    buyAmount:String(q.buyAmount),
    minBuyAmount:q.minBuyAmount?String(q.minBuyAmount):null,
    approvalSpender:addressOk(q.issues?.allowance?.spender)?q.issues.allowance.spender:(addressOk(q.allowanceTarget)?q.allowanceTarget:null),
    gasUsd:null,providerFeeUsd:null,route,transaction:tx
  };
}

module.exports = async function handler(req,res){
  if(req.method!=="GET") return json(res,405,{error:"METHOD_NOT_ALLOWED"});
  try{
    const {sellToken,buyToken,sellAmount,taker,provider="all"}=req.query||{};
    const slippageBps=Number(req.query?.slippageBps||50);
    if(!addressOk(sellToken)||!addressOk(buyToken)) return json(res,400,{error:"INVALID_TOKEN_ADDRESS"});
    if(sellToken.toLowerCase()===buyToken.toLowerCase()) return json(res,400,{error:"TOKENS_MUST_DIFFER"});
    if(!addressOk(taker)) return json(res,400,{error:"INVALID_TAKER"});
    try{ if(BigInt(sellAmount)<=0n) throw 0; }catch{return json(res,400,{error:"INVALID_SELL_AMOUNT"});}
    if(!Number.isInteger(slippageBps)||slippageBps<1||slippageBps>500) return json(res,400,{error:"INVALID_SLIPPAGE"});
    if(!["all","lifi","0x"].includes(provider)) return json(res,400,{error:"INVALID_PROVIDER"});

    const jobs=[];
    if(provider==="all"||provider==="lifi") jobs.push(["LI.FI",()=>getLifi({sellToken,buyToken,sellAmount,taker,slippageBps})]);
    if((provider==="all"||provider==="0x") && process.env.ZEROX_API_KEY) jobs.push(["0x",()=>getZeroX({sellToken,buyToken,sellAmount,taker,slippageBps})]);

    const settled=await Promise.all(jobs.map(async ([name,fn])=>{
      try{return {ok:true,value:await fn()}}catch(e){return {ok:false,provider:name,error:e.message||String(e)}}
    }));
    const quotes=settled.filter(x=>x.ok).map(x=>x.value).sort((a,b)=>{
      const A=BigInt(a.buyAmount),B=BigInt(b.buyAmount);return A===B?0:(A>B?-1:1);
    });
    const errors=settled.filter(x=>!x.ok).map(({provider,error})=>({provider,error}));
    return json(res,200,{
      chainId:CHAIN_ID,protocolFeeBps:0,ranking:"highest expected output",
      providers:[
        {name:"LI.FI",enabled:true},
        {name:"0x",enabled:!!process.env.ZEROX_API_KEY}
      ],
      quotes,errors,generatedAt:new Date().toISOString()
    });
  }catch(e){
    return json(res,500,{error:e.message||"QUOTE_FAILED"});
  }
};