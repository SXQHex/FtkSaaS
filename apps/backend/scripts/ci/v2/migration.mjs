import path from 'node:path';
import {init,parse} from 'es-module-lexer';
await init;

// Used only for one-time migration and parity checks, never test execution.
// Change relative module/resource specifiers while preserving all other bytes.
export function relocateImports(code,source,target){
 const [imports]=parse(code),edits=[];
 const relative=specifier=>{
  let result=path.posix.relative(path.posix.dirname(target),path.posix.normalize(path.posix.join(path.posix.dirname(source),specifier)));
  if(!result.startsWith('.'))result='./'+result;
  return result;
 };
 for(const entry of imports){
  if(entry.n?.startsWith('.'))edits.push({start:entry.s,end:entry.e,value:entry.d>=0?JSON.stringify(relative(entry.n)):relative(entry.n)});
 }
 // The lexer identifies real import.meta expressions, excluding strings/comments.
 for(const match of code.matchAll(/new URL\((['"])(\.[^'"\n]*)\1,\s*import\.meta\.url\)/g)){
  if(!imports.some(entry=>entry.d===-2&&entry.s>=match.index&&entry.e<=match.index+match[0].length))continue;
  const start=match.index+match[0].indexOf(match[1])+1;
  edits.push({start,end:start+match[2].length,value:relative(match[2])});
 }
 for(const edit of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.value+code.slice(edit.end);
 return code;
}
