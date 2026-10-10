import "dotenv/config";
import {runtimeConfiguration} from "./runtimeConfiguration";
// Validate before importing modules that construct Prisma or Stripe clients.
try {
 const config=runtimeConfiguration();
 if("production" in config && config.production)require("./productionConfiguration").requireProductionLegacyReadiness();
 const {createApp}=require("./app") as typeof import("./app");
 const app=createApp("production" in config && config.production?{logging:false,production:true,orderAccessRequired:true,navigationHandoffEnabled:config.navigationHandoffEnabled,shippingEnabled:true,handoffOrigins:config.handoffOrigins,allowedOrigins:config.origins}:config.staging?{logging:false,orderAccessRequired:true,handoffOrigins:config.handoffOrigins,allowedOrigins:config.origins,staging:true}:{});
 app.listen(config.port,"0.0.0.0",()=>console.log(`Server listening on port ${config.port}`)).on("error",()=>{console.error("Server startup failed");process.exitCode=1;});
}catch(error){console.error(error instanceof Error && error.message==="PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED" ? error.message : "Server configuration invalid; startup refused");process.exitCode=1;}
