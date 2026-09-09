
module.exports=async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  const missing=[];
  if(!process.env.ALCHEMY_API_KEY)missing.push("ALCHEMY_API_KEY");
  if(!process.env.ALCHEMY_GAS_POLICY_ID)missing.push("ALCHEMY_GAS_POLICY_ID");
  if(!process.env.GLITCH_GASLESS_SIGNING_SECRET)missing.push("GLITCH_GASLESS_SIGNING_SECRET");
  res.status(200).json({
    ok:true,
    app:"GLITCH ROUTER V4 // GASLESS HOLDERS",
    chainId:4663,
    protocolFeeBps:0,
    providers:{lifi:true,uniswapDirectV3:true},
    gasless:{
      holderRequired:true,
      nftContract:"0x27390fe7ae676fbfdb632e61cd4019996b07892c",
      mode:"EIP-7702 + Alchemy Gas Manager",
      configured:missing.length===0,
      missing
    }
  });
};
