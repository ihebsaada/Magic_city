// Dedicated Render staging entrypoint cannot silently use production defaults.
if(process.env.DEPLOYMENT_ENV && process.env.DEPLOYMENT_ENV!=="staging"){
 console.error("Staging deployment mode invalid");process.exitCode=1;
}else{process.env.DEPLOYMENT_ENV="staging";require("./server");}
