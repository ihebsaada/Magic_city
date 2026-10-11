import {useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {useIsFetching,useIsMutating} from '@tanstack/react-query';
import {useLoading} from '@/contexts/LoadingContext';
export function useHistoricalLoading(){
 const location=useLocation();const [routeLoading,setRouteLoading]=useState(false);
 const fetching=useIsFetching(),mutating=useIsMutating();const {isLoading}=useLoading();
 useEffect(()=>{setRouteLoading(true);const timer=setTimeout(()=>setRouteLoading(false),400);return()=>clearTimeout(timer);},[location.pathname]);
 return fetching>0||mutating>0||isLoading||routeLoading;
}
