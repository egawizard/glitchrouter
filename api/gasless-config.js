
module.exports=async function handler(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  const apiKey=process.env.ALCHEMY_API_KEY||"";
  const policyId=process.env.ALCHEMY_GAS_POLICY_ID||"";
  res.status(200).json({
    enabled:!!(apiKey&&policyId&&process.env.GLITCH_GASLESS_SIGNING_SECRET),
    alchemyApiKey:apiKey,
    policyId,
    chainId:4663,
    mode:"EIP-7702",
    holderRequired:true
  });
};
