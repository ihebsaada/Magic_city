import {Prisma} from '@prisma/client';
import prisma from '../prisma';
export class SecureOrderPolicyError extends Error {
 constructor(public status:number,public code:string,public orderId?:string){super(code);}
}
type Reader=Pick<Prisma.TransactionClient,'secureOrderPolicy'>;
// No date/number/token inference, no backfill and no compatibility fallback.
export async function requireSecureOrder(orderId:string,db:Reader=prisma):Promise<void>{
 let row;
 try {row=await db.secureOrderPolicy.findUnique({where:{orderId}});}
 catch {throw new SecureOrderPolicyError(503,'ORDER_POLICY_UNAVAILABLE');}
 if(!row || row.policyVersion!==1)throw new SecureOrderPolicyError(409,'HISTORICAL_ORDER_READ_ONLY',orderId);
}
