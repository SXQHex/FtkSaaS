// One production adapter. No caller-supplied time/random/sequence and no v4 fallback.
import {v7,validate,version} from 'uuid';
export function newUuidV7(){const value=v7();if(!validate(value)||version(value)!==7)throw new Error('UUIDV7_GENERATOR_UNAVAILABLE');return value;}
export function newOperation(){return Object.freeze({request_id:newUuidV7(),operation_key:newUuidV7()});}
// Retain operation_key unchanged on retry; a new request_id may identify the transport attempt.
