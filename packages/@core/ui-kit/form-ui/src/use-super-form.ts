import type {
  BaseFormComponentType,
  ExtendedFormApi,
  SuperFormProps,
} from './types';

import { defineComponent, h, isReactive, onBeforeUnmount, watch } from 'vue';

import { useStore } from '@super-core/shared/store';

import { FormApi } from './form-api';
import SuperUseForm from './super-use-form.vue';

export function useSuperForm<
  T extends BaseFormComponentType = BaseFormComponentType,
  P extends Record<string, any> = Record<never, never>,
>(options: SuperFormProps<T, P>) {
  const IS_REACTIVE = isReactive(options);
  const api = new FormApi(options as unknown as SuperFormProps);
  const extendedApi: ExtendedFormApi = api as never;
  extendedApi.useStore = (selector) => {
    return useStore(api.store, selector);
  };

  const Form = defineComponent(
    (props: SuperFormProps, { attrs, slots }) => {
      onBeforeUnmount(() => {
        api.unmount();
      });
      api.setState({ ...props, ...attrs });
      return () =>
        h(SuperUseForm, { ...props, ...attrs, formApi: extendedApi }, slots);
    },
    {
      name: 'SuperUseForm',
      inheritAttrs: false,
    },
  );
  // Add reactivity support
  if (IS_REACTIVE) {
    watch(
      () => options.schema,
      () => {
        api.setState({ schema: options.schema });
      },
      { immediate: true },
    );
  }

  return [Form, extendedApi] as const;
}
