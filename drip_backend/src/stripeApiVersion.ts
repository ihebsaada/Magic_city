// Explicitly approved SDK wire contract; lockfile upgrade requires review/tests.
export const SUPPORTED_STRIPE_API_VERSION='2025-12-15.clover';
export function validateStripeApiVersion(value:string|undefined){
 if(value!==undefined && value!=='' && value!==SUPPORTED_STRIPE_API_VERSION)
  throw new Error('STRIPE_API_VERSION_INCOMPATIBLE');
}
