// Imported only by the experimental ESM hook; original test sources stay intact.
import nativeTest from 'node:test';
export * from 'node:test';

function body(fn){
 const invoke=(self,context,done)=>{
  // Wrap before user diagnostics decorate t.test: their explicit budgets still
  // reach this native registration boundary and are replaced here.
  if(typeof context.test==='function')context.test=registration(context.test.bind(context));
  return Reflect.apply(fn,self,fn.length===2?[context,done]:[context]);
 };
 return fn.length===2?function(context,done){return invoke(this,context,done);}:function(context){return invoke(this,context);};
}
function registration(native){
 return new Proxy(native,{
  apply(target,self,args){
   const values=[...args],index=typeof values[0]==='string'?1:0;
   const options=values[index]&&typeof values[index]==='object'?values.splice(index,1)[0]:{};
   if(typeof values[index]==='function')values[index]=body(values[index]);
   values.splice(index,0,{...options,timeout:Infinity});
   return Reflect.apply(target,self,values);
  },
  get(target,key,receiver){
   const value=Reflect.get(target,key,receiver);
   return ['test','it','describe','suite','skip','todo','only'].includes(key)&&typeof value==='function'?registration(value):value;
  }
 });
}
export const test=registration(nativeTest);
export const it=test;
export const describe=registration(nativeTest.describe);
export const suite=describe;
export default test;
