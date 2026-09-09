module.exports=async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.status(200).json({
    ok:true,
    app:"GLITCH ROUTER V1",
    chainId:4663,
    protocolFeeBps:0,
    providers:{lifi:true,zeroX:!!process.env.ZEROX_API_KEY},
    rpc:process.env.RH_RPC_URL?"custom":"official-default"
  });
};