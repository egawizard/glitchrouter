
const crypto=require("crypto");
const {nftBalance}=require("../lib/holder");

function json(res,body){res.statusCode=200;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(body));}
function sign(payload,secret){return crypto.createHmac("sha256",secret).update(payload).digest("base64url");}
function safeEq(a,b){try{return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b))}catch{return false}}
function parseTicket(t,secret){
  if(typeof t!=="string"||!t.includes("."))throw new Error("NO_TICKET");
  const [payload,sig]=t.split(".");
  if(!safeEq(sign(payload,secret),sig))throw new Error("BAD_TICKET_SIGNATURE");
  const body=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
  if(body.v!==1||!body.wallet||!body.exp)throw new Error("BAD_TICKET");
  if(Math.floor(Date.now()/1000)>Number(body.exp))throw new Error("TICKET_EXPIRED");
  return body;
}
function senderOf(uo){
  return String(uo?.sender||uo?.senderAddress||"").toLowerCase();
}
function callDataOf(uo){
  return String(uo?.callData||uo?.data||"").toLowerCase();
}

module.exports=async function handler(req,res){
  // Gas Manager expects HTTP 200 with {approved:boolean}.
  if(req.method!=="POST")return json(res,{approved:false,reason:"METHOD_NOT_ALLOWED"});
  try{
    const secret=process.env.GLITCH_GASLESS_SIGNING_SECRET||"";
    if(!secret)throw new Error("SERVER_NOT_CONFIGURED");

    const expectedPolicy=process.env.ALCHEMY_GAS_POLICY_ID||"";
    const chainId=Number(req.body?.chainId);
    const policyId=String(req.body?.policyId||"");
    if(chainId!==4663)throw new Error("WRONG_CHAIN");
    if(expectedPolicy && policyId!==expectedPolicy)throw new Error("WRONG_POLICY");

    const ticket=parseTicket(req.body?.webhookData,secret);
    const sender=senderOf(req.body?.userOperation);
    if(sender!==ticket.wallet)throw new Error("SENDER_MISMATCH");

    const balance=await nftBalance(sender);
    if(balance<1n)throw new Error("NOT_A_HOLDER");

    // Defense-in-depth: Wallet APIs encodes nested calls into userOperation
    // calldata. The exact signed swap payload and approved top-level router
    // must both be present. Budget/rate caps should ALSO be enabled in the
    // Alchemy policy dashboard.
    const cd=callDataOf(req.body?.userOperation);
    const target=ticket.routeTarget.replace(/^0x/,"");
    const swapData=String(ticket.swapData||"0x").replace(/^0x/,"");
    if(!cd || !cd.includes(target))throw new Error("ROUTE_TARGET_NOT_IN_USEROP");
    if(swapData.length>8 && !cd.includes(swapData))throw new Error("SWAP_PAYLOAD_NOT_IN_USEROP");

    return json(res,{approved:true});
  }catch(e){
    return json(res,{approved:false,reason:String(e.message||"DENIED").slice(0,96)});
  }
};
