import {test} from "node:test";
import assert from "node:assert/strict";
import {validatePaymentURL,pay,preparePairing,checkPairing,readAttempt,CheckoutError} from "@/lib/secureCheckout";
const allowed=process.env.PAYMENT_SIMULATOR_ALLOWED==="true";
const browserOrigin=process.env.PAYMENT_BROWSER_ORIGIN??"http://127.0.0.1:5174";
Object.defineProperty(globalThis,"window",{value:{location:{origin:browserOrigin}},configurable:true});
test("Stripe exact HTTPS origin remains accepted",()=>{assert.equal(validatePaymentURL("https://checkout.stripe.com/c/pay/cs_test").origin,"https://checkout.stripe.com");});
test("official Stripe fragment is preserved without relaxing its exact origin",()=>{const value="https://checkout.stripe.com/c/pay/cs_test#fidkdWxOYHwnPyd1blppbHNgWjA0";assert.equal(validatePaymentURL(value).href,value);assert.equal(validatePaymentURL(value).hash,"#fidkdWxOYHwnPyd1blppbHNgWjA0");});

test("malicious URLs, credentials, unexpected ports and simulator fragments are rejected",()=>{
 for(const url of ["http://checkout.stripe.com/pay","https://checkout.stripe.com.evil.invalid/pay","https://sub.checkout.stripe.com/pay","https://checkout.stripe.com:444/pay","https://user:password@checkout.stripe.com/pay","not a URL","http://127.0.0.1:4102/session/test","http://localhost:4101/session/test","https://127.0.0.1:4101/session/test","http://127.0.0.1.evil.invalid:4101/session/test","http://user:password@127.0.0.1:4101/session/test","http://127.0.0.1:4101/session/test#secret"])assert.throws(()=>validatePaymentURL(url),CheckoutError,url);
});
test("local simulator capability matches compile-time configuration and browser origin",()=>{
 const url="http://127.0.0.1:4101/session/cs_stage_test";
 if(allowed)assert.equal(validatePaymentURL(url).origin,"http://127.0.0.1:4101");
 else assert.throws(()=>validatePaymentURL(url),CheckoutError);
});
test("pay saves the validated session before returning for navigation; rejected destinations save no session",async()=>{
 const data=new Map<string,string>();
 globalThis.sessionStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);},clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size;}};
 const order="synthetic-url-policy",token="T".repeat(43);
 let session="cs_stage_test";
 globalThis.fetch=async(url)=>{
  const pathname=new URL(String(url)).pathname;
  if(pathname.endsWith("/prepare"))return Response.json({accessToken:token,expiresAt:new Date(Date.now()+900000).toISOString()});
  if(pathname.endsWith("/order-handoffs")||pathname.endsWith("/redeem"))return Response.json({pairingId:"P".repeat(32),orderId:order,phrase:"abcd-1234-5678",expiresAt:new Date(Date.now()+300000).toISOString(),state:pathname.endsWith("/redeem")?"approved":"pending"});
  return Response.json({url:"http://127.0.0.1:4101/session/cs_stage_test",sessionId:session});
 };
 await preparePairing(order);await checkPairing(order);
 if(allowed){
  const response=await pay(order);
  assert.equal(readAttempt(order).sessionId,response.sessionId);
  assert.equal(readAttempt(order).sessionUrl,response.url);
  session="invalid";
  await assert.rejects(pay(order),CheckoutError);
  assert.equal(readAttempt(order).sessionId,"cs_stage_test");
 }else{await assert.rejects(pay(order),CheckoutError);assert.equal(readAttempt(order).sessionId,undefined);}
 assert.equal(readAttempt(order).token,token);assert.equal(readAttempt(order).orderId,order);
});
