import type { MessagePlugin } from 'tdesign-vue-next';

declare global {
  const $t: (key: string, ...args: any[]) => string;

  interface Window {
    $message: typeof MessagePlugin;
    $t: (key: string, ...args: any[]) => string;
  }
}

export {};
