
const crypto=require("crypto");
const {nftBalance}=require("../lib/holder");

const UNISWAP="0xcaf681a66d020601342297493863e78c959e5cb2";
const LIFI_CHAIN_ROUTER="0xb477751b76cf82d00a686a1232f5fcd772414af3";
const LIFI_DIAMOND="0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae";
const ROUTERS=new Set([UNISWAP,LIFI_CHAIN_ROUTER,LIFI_DIAMOND]);
const APPROVE_SELECTOR="095ea7b3";

function okAddress(v){return /^0x[a-fA-F0-9]{40}$/.test(v||"");}
function okHex(v){return /^0x[0-9a-fA-F]*$/.test(v||"");}
function json(res,code,body){res.statusCode=code;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(body));}
function b64(v){return Buffer.from(v).toString("base64url");}
function sign(payload,secret){return crypto.createHmac("sha256",secret).update(payload).digest("base64url");}
function norm(v){return String(v||"").toLowerCase();}
function toBig(v){try{return BigInt(v||0)}catch{return -1n}}

function validateCalls(provider,calls){
  if(!Array.isArray(calls)||calls.length<1||calls.length>2)throw new Error("INVALID_CALL_COUNT");
  for(const c of calls){
    if(!okAddress(c.to)||!okHex(c.data||"0x"))throw new Error("INVALID_CALL");
    if(toBig(c.value)<0n)throw new Error("INVALID_CALL_VALUE");
  }

  const swap=calls[calls.length-1];
  const target=norm(swap.to);
  if(!ROUTERS.has(target))throw new Error("SWAP_TARGET_NOT_ALLOWED");

  if(provider==="uniswap" && target!==UNISWAP)throw new Error("UNISWAP_TARGET_MISMATCH");
  if(provider==="lifi" && ![LIFI_CHAIN_ROUTER,LIFI_DIAMOND].includes(target))throw new Error("LIFI_TARGET_MISMATCH");
  if(!["uniswap","lifi"].includes(provider))throw new Error("PROVIDER_NOT_ALLOWED");

  if(calls.length===2){
    const approval=calls[0];
    const d=(approval.data||"0x").toLowerCase();
    if(d.slice(2,10)!==APPROVE_SELECTOR)throw new Error("FIRST_CALL_MUST_BE_ERC20_APPROVE");
    if(toBig(approval.value)!==0n)throw new Error("APPROVE_VALUE_MUST_BE_ZERO");
    // Restrict approval spender to known execution routers.
    if(d.length<2+8+64+64)throw new Error("MALFORMED_APPROVE");
    const spender="0x"+d.slice(2+8+24,2+8+64);
    if(!ROUTERS.has(spender))throw new Error("APPROVAL_SPENDER_NOT_ALLOWED");
  }
  return swap;
}

module.exports=async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"METHOD_NOT_ALLOWED"});
  const secret=process.env.GLITCH_GASLESS_SIGNING_SECRET||"";
  if(!secret)return json(res,503,{error:"GASLESS_SIGNING_SECRET_MISSING"});
  try{
    const {wallet,provider,calls}=req.body||{};
    if(!okAddress(wallet))return json(res,400,{error:"INVALID_WALLET"});
    const balance=await nftBalance(wallet);
    if(balance<1n)return json(res,403,{error:"DEAD_PIXELS_HOLDER_REQUIRED"});

    const swap=validateCalls(String(provider||""),calls);
    const now=Math.floor(Date.now()/1000);
    const body={
      v:1,
      wallet:norm(wallet),
      provider:String(provider),
      routeTarget:norm(swap.to),
      // Include exact swap calldata so the sponsorship webhook can require
      // that this intended swap payload is embedded in the UserOperation.
      swapData:(swap.data||"0x").toLowerCase(),
      iat:now,
      exp:now+75,
      nonce:crypto.randomBytes(12).toString("hex")
    };
    const payload=b64(JSON.stringify(body));
    const sig=sign(payload,secret);
    return json(res,200,{ticket:`${payload}.${sig}`,expiresIn:75,holderBalance:balance.toString()});
  }catch(e){
    return json(res,400,{error:e.message||"GASLESS_TICKET_FAILED"});
  }
};
