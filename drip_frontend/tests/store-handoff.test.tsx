import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {create,act,type ReactTestRenderer} from 'react-test-renderer';
import {CheckoutHandoff} from '@/components/CheckoutHandoff';
import {newCheckoutAttempt,resumeCheckoutAttempt,loadCheckoutAttempt} from '@/lib/checkoutAttempt';
const values=new Map<string,string>();
const storage:Storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);},clear:()=>values.clear(),key:()=>null,length:0};
globalThis.sessionStorage=storage;globalThis.fetch=async()=>{throw new Error('Live network forbidden');};
let renderer:ReactTestRenderer|undefined;
afterEach(()=>{if(renderer)act(()=>renderer!.unmount());renderer=undefined;values.clear();globalThis.fetch=async()=>{throw new Error('Live network forbidden');};});
const token='S'.repeat(43),pairingId='P'.repeat(32),orderId='synthetic-order';
async function mount(){
 globalThis.fetch=async url=>String(url).endsWith('/prepare')?Response.json({accessToken:token,expiresAt:new Date(Date.now()+900000).toISOString()}):Response.json({orderId,redirectUrl:'https://dripcheckout.netlify.app/checkout-landing?orderId='+orderId});
 newCheckoutAttempt({customerName:'Synthetic',customerEmail:'synthetic@example.invalid',items:[{productId:1,quantity:1}]},10);await resumeCheckoutAttempt();
 act(()=>{renderer=create(<CheckoutHandoff orderId={orderId}/>);});
}
function input(code=pairingId){act(()=>renderer!.root.findByType('input').props.onChange({target:{value:code}}));}
async function click(text:string){await act(async()=>{await renderer!.root.findAllByType('button').find(b=>String(b.children).includes(text))!.props.onClick();await new Promise(r=>setTimeout(r,5));});}
test('Store requires inspection and explicit comparison before scoped approval; frozen attempt is preserved',async()=>{
 await mount();const saved=JSON.stringify(loadCheckoutAttempt()),calls:string[]=[];
 globalThis.fetch=async(url,init)=>{calls.push(String(url));assert.equal(new Headers(init?.headers).get('Order-Access-Token'),token);assert.ok(!String(url).includes(token));return Response.json({pairingId,orderId,phrase:'abcd-1234-5678',state:String(url).endsWith('/approve')?'approved':'pending'});};
 input();assert.equal(renderer!.root.findAllByType('button').length,1);await click('Controlla');assert.equal(calls.length,1);assert.ok(calls[0].endsWith('/inspect'));await click('I codici');assert.ok(calls[1].endsWith('/approve'));assert.equal(JSON.stringify(loadCheckoutAttempt()),saved);
 const link=renderer!.root.findByType('a');assert.equal(link.props.rel,'noopener noreferrer');assert.ok(!link.props.href.includes(token));
});
test('fabricated response for another order cannot expose approval UI',async()=>{await mount();input();globalThis.fetch=async()=>Response.json({pairingId,orderId:'other',phrase:'abcd-1234-5678',state:'pending'});await click('Controlla');assert.equal(renderer!.root.findAllByType('button').length,1);});
test('lost approval response retries same pairing and Store credential without recreating order',async()=>{await mount();input();let lost=true,approvals=0;globalThis.fetch=async(url,init)=>{assert.equal(new Headers(init?.headers).get('Order-Access-Token'),token);if(String(url).endsWith('/approve')){approvals++;if(lost){lost=false;throw new TypeError('offline');}}return Response.json({pairingId,orderId,phrase:'abcd-1234-5678',state:String(url).endsWith('/approve')?'approved':'pending'});};await click('Controlla');await click('I codici');await click('I codici');assert.equal(approvals,2);assert.equal(loadCheckoutAttempt()!.result!.orderId,orderId);});
test('missing scoped credential blocks inspection without anonymous fallback',async()=>{act(()=>{renderer=create(<CheckoutHandoff orderId={orderId}/>);});input();let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('forbidden');};await click('Controlla');assert.equal(calls,0);});
test('changing entered pairing removes previously inspected authorization button',async()=>{await mount();input();globalThis.fetch=async()=>Response.json({pairingId,orderId,phrase:'abcd-1234-5678',state:'pending'});await click('Controlla');assert.equal(renderer!.root.findAllByType('button').length,2);input('Q'.repeat(32));assert.equal(renderer!.root.findAllByType('button').length,1);});
