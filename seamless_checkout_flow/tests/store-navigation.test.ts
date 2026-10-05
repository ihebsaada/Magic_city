import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {storeUrl,redirectToStoreCart} from "../src/lib/storeNavigation";
test("configured Store URLs have fixed destinations",()=>{assert.equal(storeUrl("/cart","https://store.example.invalid"),"https://store.example.invalid/cart");assert.equal(storeUrl("/","http://127.0.0.1:5173"),"http://127.0.0.1:5173/");});
test("missing configuration blocks instead of falling back",()=>{assert.throws(()=>storeUrl("/cart"));});
test("untrusted URL forms are rejected",()=>{for(const value of ["", " https://store.example.invalid", "https://user:password@store.example.invalid", "https://store.example.invalid/cart", "https://store.example.invalid?next=x", "https://store.example.invalid#x", "http://store.example.invalid", "javascript:alert(1)", "//store.example.invalid"])assert.throws(()=>storeUrl("/cart",value));});
test("redirect fails closed without navigation or browser state mutation",()=>{let navigations=0;Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{replace:()=>navigations++},sessionStorage:{getItem:()=>{throw Error("must not read");}},localStorage:{getItem:()=>{throw Error("must not read");}}}});assert.throws(()=>redirectToStoreCart());assert.equal(navigations,0);});
test("historical mirror cart is restored without generic payment or private order fallback",()=>{const cart=readFileSync("src/pages/Cart.tsx","utf8");assert.doesNotMatch(cart,/seamless\/checkout|fetch\(|window.location.href/);assert.match(cart,/handleQuantityChange/);assert.match(cart,/carrello.*vuoto/);assert.match(readFileSync("src/pages/Home.tsx","utf8"),/Collezione Shop/);assert.match(readFileSync("src/pages/OrderConfirmation.tsx","utf8"),/await confirm/);});
