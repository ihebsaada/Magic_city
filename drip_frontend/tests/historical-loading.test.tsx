import test from 'node:test';import assert from 'node:assert/strict';import {create,act} from 'react-test-renderer';import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {LoadingProvider} from '@/contexts/LoadingContext';import {useHistoricalLoading} from '@/hooks/useHistoricalLoading';import {LoadingScreen} from '@/components/LoadingScreen';
test('historical spinner ends after navigation, failed query and successful retry',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});function Probe(){return useHistoricalLoading()?<LoadingScreen/>:<p>Ready</p>;}
 let root:ReturnType<typeof create>;await act(async()=>{root=create(<MemoryRouter><QueryClientProvider client={client}><LoadingProvider><Probe/></LoadingProvider></QueryClientProvider></MemoryRouter>);});assert.match(JSON.stringify(root!.toJSON()),/animate-spin/);
 await act(async()=>{await new Promise(r=>setTimeout(r,420));});assert.match(JSON.stringify(root!.toJSON()),/Ready/);
 let reject!:(error:Error)=>void;await act(async()=>{void client.fetchQuery({queryKey:['test'],queryFn:()=>new Promise((_r,j)=>{reject=j;})}).catch(()=>{});await new Promise(r=>setTimeout(r,5));});assert.match(JSON.stringify(root!.toJSON()),/animate-spin/);
 await act(async()=>{reject(Error('synthetic'));await new Promise(r=>setTimeout(r,5));});assert.match(JSON.stringify(root!.toJSON()),/Ready/);
 await act(async()=>{await client.fetchQuery({queryKey:['test'],queryFn:async()=>1});await new Promise(r=>setTimeout(r,5));});assert.match(JSON.stringify(root!.toJSON()),/Ready/);root!.unmount();client.clear();
});
