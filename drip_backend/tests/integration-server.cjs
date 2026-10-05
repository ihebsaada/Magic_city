// Separate server processes allow a real restart test. Configuration comes only from the isolated runner.
class FakeStripe { constructor(){ this.checkout={sessions:{create:()=>{throw new Error("Real payment forbidden");},retrieve:()=>{throw new Error("Payment forbidden");}}}; this.webhooks={constructEvent:()=>{throw new Error("Webhook forbidden");}}; } }
require.cache[require.resolve("stripe")]={exports:FakeStripe};
const {createApp}=require("../dist/app");
const prisma=require("../dist/prisma").default;
const app=require("express")();
app.use((req,res,next)=>{
  if(req.headers["x-test-drop-response"]==="yes") res.json=()=>{res.destroy(); return res;};
  next();
});
app.use(createApp({logging:false}));
const server=app.listen(0,"127.0.0.1",()=>process.send({port:server.address().port}));
process.on("message",async message=>{if(message==="stop"){server.closeAllConnections();server.close(async()=>{await prisma.$disconnect();process.exit(0);});}});
