import type {HTMLAttributes} from 'react';
import {cn} from '@/lib/utils';

export function ProductGrid({className,...props}:HTMLAttributes<HTMLDivElement>){
 return <div className={cn('store-product-grid grid grid-cols-2 gap-3 sm:gap-6',className)} {...props}/>;
}
