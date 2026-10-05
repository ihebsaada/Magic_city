import {Router,RequestHandler} from 'express';
import {createNavigation,redeemNavigation} from '../services/navigationHandoff';
import {GuestAccessError} from '../services/guestOrderAccess';
import {DEFAULT_HANDOFF_ORIGINS,throttle} from './orderHandoffRoutes';
export function navigationCors(origins=DEFAULT_HANDOFF_ORIGINS):RequestHandler{return(req,res,next)=>{
 if(!/^\/api\/(?:navigation-handoffs(?:\/|$)|orders\/[^/]+\/navigation-handoffs(?:\/|$))/i.test(req.path))return next();
 res.set({'Cache-Control':'no-store',Pragma:'no-cache','Referrer-Policy':'no-referrer',Vary:'Origin'});
 if(!req.app.locals.staging)return res.status(404).json({error:'NOT_FOUND'});
 const expected=/\/orders\//i.test(req.path)?origins.store:origins.checkout;
 if(req.get('Origin')!==expected)return res.status(403).json({error:'NAVIGATION_ORIGIN_DENIED'});
 res.set({'Access-Control-Allow-Origin':expected,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Order-Access-Token, Idempotency-Key'});
 if(req.method==='OPTIONS')return res.sendStatus(204);next();
};}
const router=Router();
const handler=(f:(req:Parameters<RequestHandler>[0])=>Promise<unknown>):RequestHandler=>async(req,res)=>{try{res.json(await f(req));}catch(e){if(e instanceof GuestAccessError){if(e.status===429)res.set('Retry-After','60');res.status(e.status).json({error:e.code});}else res.status(503).json({error:'NAVIGATION_RETRY'});}};
router.post('/orders/:id/navigation-handoffs',throttle,handler(req=>createNavigation(req.params.id,req.get('Order-Access-Token'),req.get('Idempotency-Key'),req.app.locals.handoffOrigins.checkout)));
router.post('/navigation-handoffs/redeem',throttle,handler(req=>redeemNavigation(req.body?.orderId,req.body?.ticket,req.get('Order-Access-Token'),req.get('Origin')!)));
export default router;
