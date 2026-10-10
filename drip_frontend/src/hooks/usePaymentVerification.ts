import {useEffect,useRef,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {startPaidOrderCheck} from '@/lib/paidOrderCheck';

function currentOrderId():string|null|undefined {
 try{return localStorage.getItem('lastOrderId');}catch{return undefined;}
}

export function usePaymentVerification(onPaid:(orderId:string)=>void){
 const {pathname}=useLocation();
 const paid=useRef(onPaid);paid.current=onPaid;
 const [warningOrder,setWarningOrder]=useState<string|null>(null);
 useEffect(()=>{
  let stop:undefined|(()=>void);
  let observed:string|null|undefined;
  const synchronize=()=>{
   const orderId=currentOrderId();
   if(orderId===undefined||orderId===observed)return;
   observed=orderId;stop?.();
   setWarningOrder(previous=>previous===orderId?previous:null);
   if(!orderId)return;
   stop=startPaidOrderCheck({orderId,currentOrderId:()=>currentOrderId()??null,events:window,
    onAccessRequired:()=>setWarningOrder(orderId),
    onVerified:()=>setWarningOrder(previous=>previous===orderId?null:previous),
    onPaid:()=>paid.current(orderId),
   });
  };
  synchronize();
  window.addEventListener('storage',synchronize);
  window.addEventListener('focus',synchronize);
  return ()=>{stop?.();window.removeEventListener('storage',synchronize);window.removeEventListener('focus',synchronize);};
 },[pathname]);
 const current=currentOrderId();
 return warningOrder!==null&&(current===undefined||current===warningOrder)?warningOrder:null;
}
