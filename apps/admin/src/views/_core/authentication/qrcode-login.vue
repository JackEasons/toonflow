<script lang="ts" setup>
import { AuthenticationQrCodeLogin } from '@super/common-ui';
import { LOGIN_PATH } from '@super/constants';

defineOptions({ name: 'QrCodeLogin' });
</script>

<template>
  <AuthenticationQrCodeLogin :login-path="LOGIN_PATH" />
</template>
