// Agent instructions and local tooling are outside the application source tree.
export const isAgentTooling=p=>typeof p==='string'&&p.startsWith('.agents/')&&!p.includes('\\')&&!p.split('/').some(s=>!s||s==='.'||s==='..');
