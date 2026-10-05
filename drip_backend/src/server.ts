import "dotenv/config";
import {runtimeConfiguration} from "./runtimeConfiguration";
// Validate before importing modules that construct Prisma or Stripe clients.
try {
 const config=runtimeConfiguration();
 const {createApp}=require("./app") as typeof import("./app");
 const app=createApp(config.staging?{logging:false,orderAccessRequired:true,handoffOrigins:config.handoffOrigins,allowedOrigins:config.origins,staging:true}:{});
 app.listen(config.port,"0.0.0.0",()=>console.log(`Server listening on port ${config.port}`)).on("error",()=>{console.error("Server startup failed");process.exitCode=1;});
}catch{console.error("Server configuration invalid; startup refused");process.exitCode=1;}
