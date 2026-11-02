// User-owned experimental design area; excluded from production workspace and CI.
export const isDesignSandbox=p=>typeof p==='string'&&p.startsWith('apps/web1/')&&!p.includes('\\')&&!p.split('/').some(s=>!s||s==='.'||s==='..');
