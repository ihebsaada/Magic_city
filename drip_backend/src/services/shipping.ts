import {Prisma} from '@prisma/client';
// Historical threshold is the merchandise subtotal BEFORE discount.
export function shippingAmount(subtotal:Prisma.Decimal,enabled:boolean){return new Prisma.Decimal(enabled&&subtotal.lt('200.00')?'5.00':'0');}
