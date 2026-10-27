import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const backendRoot=fileURLToPath(new URL('../',import.meta.url));
export const repositoryRoot=fileURLToPath(new URL('../../../',import.meta.url));
export const repoFile=(...parts)=>path.join(repositoryRoot,...parts);
export const ciFile=(...parts)=>repoFile('.artifacts','ci',...parts);
export const backendArtifact=(...parts)=>repoFile('.artifacts','backend',...parts);
