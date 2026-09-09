module.exports=async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.status(200).json({
    ok:true,
    app:"GLITCH ROUTER V4 // GAS OPTIMIZED",
    chainId:4663,
    protocolFeeBps:0,
    paymaster:false,
    ranking:"BEST NET OUTPUT when USD pricing is available",
    optimizations:[
      "gas-aware provider ranking",
      "gas-aware Uniswap direct-vs-two-hop selection",
      "approval gas included",
      "high gas impact warning"
    ],
    providers:{lifi:true,uniswapDirectV3:true}
  });
};