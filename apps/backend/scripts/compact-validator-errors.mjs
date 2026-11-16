// Ajv 8 standalone errors have this exact generated prefix. Schema/const data
// is JSON-encoded with quoted keys, so it cannot match this code pattern.
// Keep instancePath, keyword, params and every predicate; callers consume Boolean
// validity and safe domain errors, never internal schema locations.
export function compactValidatorErrors(code){
 return code.replace(/(\{instancePath(?::instancePath(?:\s*\+\s*"(?:\\.|[^"\\])*")?)?,schemaPath:)"(?:\\.|[^"\\])*"(?=,keyword:)/g,'$1""');
}
