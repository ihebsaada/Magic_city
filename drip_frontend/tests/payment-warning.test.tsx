import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter,useNavigate,type NavigateFunction} from 'react-router-dom';
import {usePaymentVerification} from '@/hooks/usePaymentVerification';
import {startPaidOrderCheck} from '@/lib/paidOrderCheck';
import {HttpError} from '@/services/request';
let data:Map<string,string>,renderer:ReactTestRenderer|undefined,navigate:NavigateFunction,paid:string[];
const flush=()=>new Promise(resolve=>setTimeout(resolve,10));
function Probe(){navigate=useNavigate();const warning=usePaymentVerification(id=>paid.push(id));return <div>{warning??'none'}</div>;}
async function mount(){await act(async()=>{renderer=create(<MemoryRouter initialEntries={['/']}><Probe/></MemoryRouter>);await flush();});}
async function route(path:string){await act(async()=>{navigate(path);await flush();});}
const warning=()=>renderer!.root.findByType('div').children.join('');
beforeEach(()=>{data=new Map([['lastOrderId','A']]);paid=[];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null}});Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>key==='magic-city-drip-order-access'?JSON.stringify({A:'a'.repeat(43),B:'b'.repeat(43)}):null}});Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});globalThis.fetch=async()=>Response.json({}, {status:401});});
afterEach(()=>{if(renderer)act(()=>renderer!.unmount());renderer=undefined;});
test('active 401/403 warning remains order-scoped across Home, Catalogo and Collezioni',async()=>{await mount();assert.equal(warning(),'A');for(const path of ['/catalog','/collections','/']){globalThis.fetch=async()=>Response.json({}, {status:403});await route(path);assert.equal(warning(),'A');}assert.deepEqual(paid,[]);});
test('changing or removing the order discards only the obsolete warning',async()=>{await mount();data.set('lastOrderId','B');globalThis.fetch=async()=>Response.json({id:'B',paymentStatus:'PENDING'});await route('/catalog');assert.equal(warning(),'none');assert.deepEqual(paid,[]);globalThis.fetch=async()=>Response.json({}, {status:401});await route('/collections');assert.equal(warning(),'B');data.delete('lastOrderId');await act(async()=>{window.dispatchEvent(new Event('focus'));await flush();});assert.equal(warning(),'none');});
test('authorized exact-order response clears access warning; only PAID signals finalization',async()=>{await mount();globalThis.fetch=async()=>Response.json({id:'A',paymentStatus:'PENDING'});await route('/catalog');assert.equal(warning(),'none');assert.deepEqual(paid,[]);globalThis.fetch=async()=>Response.json({id:'A',paymentStatus:'PAID'});await route('/collections');assert.deepEqual(paid,['A']);});
test('another order response cannot clear an active warning or finalize a cart',async()=>{await mount();globalThis.fetch=async()=>Response.json({id:'B',paymentStatus:'PAID'});await route('/catalog');assert.equal(warning(),'A');assert.deepEqual(paid,[]);});
test('out-of-order denial and success cannot affect another order or a stopped check',async()=>{let current='A',deny!:(e:Error)=>void,resolve!:(value:{id:string;paymentStatus:string})=>void,warnings=0,verified=0,finalized=0;const stop=startPaidOrderCheck({orderId:'A',currentOrderId:()=>current,onPaid:()=>finalized++,onAccessRequired:()=>warnings++,onVerified:()=>verified++,read:()=>new Promise((_r,reject)=>{deny=reject;})});current='B';deny(new HttpError(401));await flush();stop();const stop2=startPaidOrderCheck({orderId:'B',currentOrderId:()=>current,onPaid:()=>finalized++,onVerified:()=>verified++,read:()=>new Promise(r=>{resolve=r;})});stop2();resolve({id:'B',paymentStatus:'PAID'});await flush();assert.equal(warnings,0);assert.equal(verified,0);assert.equal(finalized,0);});
