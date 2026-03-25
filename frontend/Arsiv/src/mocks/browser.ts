// src/mocks/browser.ts

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// setupWorker, tarayıcı ortamı için Service Worker'ı ayarlar.
export const worker = setupWorker(...handlers);