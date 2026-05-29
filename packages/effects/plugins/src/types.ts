import type { Component } from 'vue';

export interface SuperPluginsFormOptions {
  useSuperForm: (...args: any[]) => any;
}

export interface SuperPluginsModalOptions {
  useSuperModal?: () => any;
}

export interface SuperPluginsMessageOptions {
  useMessage?: () => any;
}

export interface SuperPluginsComponentsOptions {
  [key: string]: Component;
}

export interface SuperPluginsOptions {
  form?: SuperPluginsFormOptions;
  modal?: SuperPluginsModalOptions;
  message?: SuperPluginsMessageOptions;
  components?: SuperPluginsComponentsOptions;
}
