
import {Request,Response} from "express";
import {prepareGuestAccess,revokeGuestAccess,requestGuestRecovery,redeemGuestRecovery,GuestAccessError,RecoveryDelivery} from "../services/guestOrderAccess";
const failure=(res:Response,error:unknown)=>res.status(error instanceof GuestAccessError?error.status:503).json({error:error instanceof GuestAccessError?error.code:"ORDER_ACCESS_RETRY"});
export async function prepareAccess(_req:Request,res:Response){try{return res.status(201).json(await prepareGuestAccess());}catch(e){return failure(res,e);}}
export async function revokeAccess(req:Request,res:Response){try{return res.json(await revokeGuestAccess(req.params.id));}catch(e){return failure(res,e);}}
export async function requestRecovery(req:Request,res:Response){
 const delivery=req.app.locals.orderRecoveryDelivery as RecoveryDelivery|undefined;
 if(!delivery)return res.status(503).json({error:"ORDER_RECOVERY_UNAVAILABLE"});
 try {await requestGuestRecovery(req.body?.orderId,req.body?.email,delivery);}catch {/* Uniform reply; no raw request/error logging. */}
 return res.status(202).json({ok:true});
}
export async function redeemRecovery(req:Request,res:Response){try{return res.json(await redeemGuestRecovery(req.body?.recoveryToken));}catch(e){return failure(res,e);}}
