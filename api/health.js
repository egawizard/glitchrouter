module.exports=async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.status(200).json({
    ok:true,
    app:"GLITCH ROUTER V3",
    chainId:4663,
    protocolFeeBps:0,
    providers:{
      lifi:true,
      uniswapDirectV3:true
    },
    uniswap:{
      quoter:"0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
      swapRouter02:"0xcaf681a66d020601342297493863e78c959e5cb2"
    },
    rpc:process.env.RH_RPC_URL?"custom":"official-default"
  });
};