import {materialize as nativeMaterialize} from '../api-suites.mjs';
export {buildInventory,partition,executionPhases} from '../api-suites.mjs';
export const materialize=(inventory,directory,options={})=>nativeMaterialize(inventory,directory,{...options,measurementAdapter:new URL('./measurement-test.mjs',import.meta.url).href});
