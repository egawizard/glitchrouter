const {
  encodeFunctionData,
  decodeFunctionResult,
  encodePacked,
  getAddress,
  parseAbi,
  toHex
} = require("viem");

const CHAIN_ID = 4663;
const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

const UNISWAP_V3_QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
const UNISWAP_SWAP_ROUTER_02 = "0xcaf681a66d020601342297493863e78c959e5cb2";
const RPC = process.env.RH_RPC_URL || "https://rpc.mainnet.chain.robinhood.com/";
const FEES = [100, 500, 3000, 10000];

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
  "function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)"
]);

const routerAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum,address recipient) payable",
  "function multicall(bytes[] data) payable returns (bytes[] results)"
]);

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
async function fetchJson(url, opts={}, timeoutMs=14000){
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
function wrapped(token){
  return token.toLowerCase()===NATIVE ? getAddress(WETH.toLowerCase()) : getAddress(token.toLowerCase());
}
function minOut(amountOut, slippageBps){
  return (BigInt(amountOut) * BigInt(10000 - slippageBps)) / 10000n;
}
function pathHex(tokens, fees){
  const types=[], values=[];
  for(let i=0;i<tokens.length;i++){
    types.push("address"); values.push(tokens[i]);
    if(i<fees.length){types.push("uint24");values.push(fees[i]);}
  }
  return encodePacked(types, values);
}
async function rpcCall(to,data){
  const j=await fetchJson(RPC,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_call",params:[{to,data},"latest"]})
  },12000);
  if(j.error) throw new Error(j.error.message||"RPC_ERROR");
  return j.result;
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

async function quoteSingle(tokenIn,tokenOut,amountIn,fee){
  const data=encodeFunctionData({
    abi:quoterAbi,functionName:"quoteExactInputSingle",
    args:[{tokenIn,tokenOut,amountIn:BigInt(amountIn),fee,sqrtPriceLimitX96:0n}]
  });
  const result=await rpcCall(UNISWAP_V3_QUOTER,data);
  const decoded=decodeFunctionResult({abi:quoterAbi,functionName:"quoteExactInputSingle",data:result});
  return {amountOut:BigInt(decoded[0]),gasEstimate:BigInt(decoded[3]),fees:[fee],tokens:[tokenIn,tokenOut]};
}
async function quotePath(tokens,fees,amountIn){
  const path=pathHex(tokens,fees);
  const data=encodeFunctionData({
    abi:quoterAbi,functionName:"quoteExactInput",
    args:[path,BigInt(amountIn)]
  });
  const result=await rpcCall(UNISWAP_V3_QUOTER,data);
  const decoded=decodeFunctionResult({abi:quoterAbi,functionName:"quoteExactInput",data:result});
  return {amountOut:BigInt(decoded[0]),gasEstimate:BigInt(decoded[3]),fees,tokens,path};
}

function buildUniTransaction(best,{sellToken,buyToken,sellAmount,taker,slippageBps}){
  const sellNative=sellToken.toLowerCase()===NATIVE;
  const buyNative=buyToken.toLowerCase()===NATIVE;
  const minimum=minOut(best.amountOut,slippageBps);
  const recipient=buyNative ? getAddress(UNISWAP_SWAP_ROUTER_02.toLowerCase()) : getAddress(taker.toLowerCase());

  let swapData;
  if(best.fees.length===1){
    swapData=encodeFunctionData({
      abi:routerAbi,functionName:"exactInputSingle",
      args:[{
        tokenIn:best.tokens[0],tokenOut:best.tokens[1],fee:best.fees[0],
        recipient,amountIn:BigInt(sellAmount),amountOutMinimum:minimum,sqrtPriceLimitX96:0n
      }]
    });
  }else{
    swapData=encodeFunctionData({
      abi:routerAbi,functionName:"exactInput",
      args:[{path:pathHex(best.tokens,best.fees),recipient,amountIn:BigInt(sellAmount),amountOutMinimum:minimum}]
    });
  }

  let data=swapData;
  if(buyNative){
    const unwrap=encodeFunctionData({
      abi:routerAbi,functionName:"unwrapWETH9",
      args:[minimum,getAddress(taker.toLowerCase())]
    });
    data=encodeFunctionData({abi:routerAbi,functionName:"multicall",args:[[swapData,unwrap]]});
  }

  return {
    to:UNISWAP_SWAP_ROUTER_02,
    data,
    value:sellNative ? toHex(BigInt(sellAmount)) : "0x0",
    gas:null,gasPrice:null
  };
}

async function getUniswapDirect({sellToken,buyToken,sellAmount,taker,slippageBps}){
  const tokenIn=wrapped(sellToken), tokenOut=wrapped(buyToken);
  if(tokenIn.toLowerCase()===tokenOut.toLowerCase()) throw new Error("Wrapped route resolves to same token");

  const candidates=[];

  // Direct V3 pools across canonical fee tiers.
  await Promise.all(FEES.map(async fee=>{
    try{
      const q=await quoteSingle(tokenIn,tokenOut,sellAmount,fee);
      if(q.amountOut>0n)candidates.push(q);
    }catch{}
  }));

  // Two-hop direct Uniswap routes via WETH and USDG.
  const mids=[getAddress(WETH.toLowerCase()),getAddress(USDG.toLowerCase())].filter(m=>
    m.toLowerCase()!==tokenIn.toLowerCase() && m.toLowerCase()!==tokenOut.toLowerCase()
  );

  for(const mid of mids){
    const legs1=[],legs2=[];
    await Promise.all(FEES.map(async fee=>{
      try{
        const q=await quoteSingle(tokenIn,mid,sellAmount,fee);
        if(q.amountOut>0n) legs1.push({fee,out:q.amountOut});
      }catch{}
    }));
    // Only the best two first-leg fee tiers are expanded to keep RPC load reasonable.
    legs1.sort((a,b)=>a.out===b.out?0:(a.out>b.out?-1:1));
    const firstLegs=legs1.slice(0,2);
    for(const leg1 of firstLegs){
      await Promise.all(FEES.map(async fee2=>{
        try{
          const q=await quotePath([tokenIn,mid,tokenOut],[leg1.fee,fee2],sellAmount);
          if(q.amountOut>0n)candidates.push(q);
        }catch{}
      }));
    }
  }

  if(!candidates.length) throw new Error("No direct Uniswap V3 route");
  candidates.sort((a,b)=>a.amountOut===b.amountOut?0:(a.amountOut>b.amountOut?-1:1));
  const best=candidates[0];
  const tx=buildUniTransaction(best,{sellToken,buyToken,sellAmount,taker,slippageBps});
  const mid=best.tokens.length===3
    ? ` → ${best.tokens[1].toLowerCase()===WETH.toLowerCase()?"WETH":best.tokens[1].toLowerCase()===USDG.toLowerCase()?"USDG":"MID"}`
    : "";
  const fees=best.fees.map(x=>`${x/10000}%`).join(" + ");
  return {
    provider:"uniswap",label:"UNISWAP DIRECT",
    buyAmount:best.amountOut.toString(),
    minBuyAmount:minOut(best.amountOut,slippageBps).toString(),
    approvalSpender:sellToken.toLowerCase()===NATIVE?null:UNISWAP_SWAP_ROUTER_02,
    gasUsd:null,providerFeeUsd:null,
    route:`V3 DIRECT${mid} // LP FEE ${fees}`,
    transaction:tx,
    meta:{version:"v3",feeTiers:best.fees,hopCount:best.fees.length}
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
    if(!["all","lifi","uniswap"].includes(provider)) return json(res,400,{error:"INVALID_PROVIDER"});

    const args={sellToken,buyToken,sellAmount,taker,slippageBps};
    const jobs=[];
    if(provider==="all"||provider==="lifi") jobs.push(["LI.FI",()=>getLifi(args)]);
    if(provider==="all"||provider==="uniswap") jobs.push(["UNISWAP",()=>getUniswapDirect(args)]);

    const settled=await Promise.all(jobs.map(async ([name,fn])=>{
      try{return {ok:true,value:await fn()}}catch(e){return {ok:false,provider:name,error:e.message||String(e)}}
    }));

    const quotes=settled.filter(x=>x.ok).map(x=>x.value).sort((a,b)=>{
      const A=BigInt(a.buyAmount),B=BigInt(b.buyAmount);return A===B?0:(A>B?-1:1);
    });
    const errors=settled.filter(x=>!x.ok).map(({provider,error})=>({provider,error}));

    return json(res,200,{
      chainId:CHAIN_ID,protocolFeeBps:0,ranking:"highest expected token output",
      providers:[
        {name:"LI.FI",enabled:true},
        {name:"UNISWAP DIRECT",enabled:true,version:"V3"}
      ],
      quotes,errors,generatedAt:new Date().toISOString(),
      uniswap:{
        quoter:UNISWAP_V3_QUOTER,
        swapRouter02:UNISWAP_SWAP_ROUTER_02,
        feeTiers:FEES
      }
    });
  }catch(e){
    return json(res,500,{error:e.message||"QUOTE_FAILED"});
  }
};