export type {
  AlertProps,
  BeforeCloseScope,
  IconType,
  PromptProps,
} from './alert';
export { useAlertContext } from './alert';
export { default as Alert } from './alert.vue';
export {
  superAlert as alert,
  clearAllAlerts,
  superConfirm as confirm,
  superPrompt as prompt,
} from './AlertBuilder';
