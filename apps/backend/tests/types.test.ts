import type {ProductScope} from '@ftksaas/api-contracts';
const valid:ProductScope={scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['event']};
// @ts-expect-error organization scope must not carry a center selector
const invalid:ProductScope={scope_kind:'organization_all',center_id:'019fffff-ffff-7fff-8fff-ffffffffffff',discipline_id:null,usage_targets:['lesson']};
void valid;void invalid;

import {createBackendClient} from '@ftksaas/api-contracts/client';
const client=createBackendClient({functionsUrl:'http://127.0.0.1:54321/functions/v1/backend-v1',publishableKey:'synthetic',getAccessToken:async()=>null});
// @ts-expect-error unknown operation must not become callable through the shared package
void client.call('invented_operation_v1',{});
void client;

// Closed document alternatives must not add an index signature to every command input.
import type {Operations,DigitalDocumentContent} from '@ftksaas/api-contracts';
type Assert<T extends true> = T;
type IsString<T> = [T] extends [string] ? true : false;
type Publish = Operations['document_version_publish_v1']['request'];
type Preview = Operations['document_publication_preview_v1']['request'];
type Commands = {[K in keyof Operations]: Operations[K]['request'] extends {operation_key: unknown} ? Omit<Operations[K]['request'],'client_api_version'|'request_id'> : never}[keyof Operations];
export type CommandKeyIsString = Assert<IsString<Commands['operation_key']>>;
export type PublishKeyIsString = Assert<IsString<Omit<Publish,'client_api_version'|'request_id'>['operation_key']>>;
export type PreviewIsClosed = Assert<string extends keyof Preview ? false : true>;
export type PublishIsClosed = Assert<string extends keyof Publish ? false : true>;
type PublishBase = Pick<Publish,'client_api_version'|'request_id'|'org_id'|'operation_key'|'version_label'|'requirements'|'scope'>;
export type FilePublishAccepted = Assert<PublishBase & {file_id: string} extends Publish ? true : false>;
export type DigitalPublishAccepted = Assert<PublishBase & {digital_content: DigitalDocumentContent} extends Publish ? true : false>;
export type BothSourcesRejected = Assert<PublishBase & {file_id: string;digital_content: DigitalDocumentContent} extends Publish ? false : true>;
export type MissingSourceRejected = Assert<PublishBase extends Publish ? false : true>;
type PreviewBase = Omit<PublishBase,'operation_key'>;
export type FilePreviewAccepted = Assert<PreviewBase & {file_id: string} extends Preview ? true : false>;
export type DigitalPreviewAccepted = Assert<PreviewBase & {digital_content: DigitalDocumentContent} extends Preview ? true : false>;
export type BothPreviewSourcesRejected = Assert<PreviewBase & {file_id: string;digital_content: DigitalDocumentContent} extends Preview ? false : true>;
export type MissingPreviewSourceRejected = Assert<PreviewBase extends Preview ? false : true>;
