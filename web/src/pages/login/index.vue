<template>
  <div class="loginPage auth-page" :style="{ height: isElectron ? 'calc(100vh - 32px)' : '100vh' }">
    <div class="auth-ambient" aria-hidden="true">
      <span class="auth-circuit auth-circuit-left" />
      <span class="auth-circuit auth-circuit-right" />
      <span class="auth-scanline" />
      <span class="auth-data-rail auth-data-rail-top" />
      <span class="auth-data-rail auth-data-rail-bottom" />
      <span class="auth-starfield" />
      <span class="auth-orbit auth-orbit-one" />
      <span class="auth-orbit auth-orbit-two" />
      <span class="auth-beam auth-beam-left" />
      <span class="auth-beam auth-beam-right" />
    </div>

    <main class="auth-stage">
      <div class="auth-panel-wrap">
        <section class="auth-card" :class="{ 'is-register': authMode === 'register' }">
          <div class="auth-card-hud" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <div class="brand-block">
            <div class="brand-mark" aria-hidden="true"></div>
            <h1 class="auth-title">DramaStudio</h1>
            <p>{{ authMode === "login" ? $t("login.loginTo") : $t("login.joinPlatform") }}</p>
          </div>

          <div class="auth-tabs" role="tablist" :aria-label="$t('login.slogan')">
            <button type="button" :class="{ active: authMode === 'login' }" @click="switchAuthMode('login')">
              {{ $t("login.loginTab") }}
            </button>
            <button type="button" :class="{ active: authMode === 'register' }" @click="switchAuthMode('register')">
              {{ $t("login.registerTab") }}
            </button>
          </div>

          <div v-if="authNotice.text" class="auth-message" :class="authNotice.type">
            {{ authNotice.text }}
          </div>

          <form v-if="authMode === 'login'" class="auth-form" @submit.prevent="handleLogin">
            <label class="glass-field-label">{{ $t("login.username") }}</label>
            <t-input v-model="loginForm.username" :placeholder="$t('login.username')" autocomplete="username" size="large" clearable>
              <template #prefix-icon>
                <i-user theme="outline" size="18" />
              </template>
            </t-input>

            <label class="glass-field-label">{{ $t("login.password") }}</label>
            <t-input v-model="loginForm.password" type="password" :placeholder="$t('login.password')" autocomplete="current-password" size="large">
              <template #prefix-icon>
                <i-lock theme="outline" size="18" />
              </template>
            </t-input>

            <t-button class="auth-primary-action" theme="primary" size="large" :loading="loginLoading" type="submit" block>
              {{ loginLoading ? $t("login.loggingIn") : $t("login.login") }}
            </t-button>
          </form>

          <form v-else class="auth-form" @submit.prevent="handleRegister">
            <label class="glass-field-label">{{ $t("login.username") }}</label>
            <t-input v-model="registerForm.username" :placeholder="$t('login.username')" autocomplete="username" size="large" clearable>
              <template #prefix-icon>
                <i-user theme="outline" size="18" />
              </template>
            </t-input>

            <label class="glass-field-label">{{ $t("login.password") }}</label>
            <t-input v-model="registerForm.password" type="password" :placeholder="$t('login.passwordMinPlaceholder')" autocomplete="new-password" size="large">
              <template #prefix-icon>
                <i-lock theme="outline" size="18" />
              </template>
            </t-input>

            <label class="glass-field-label">{{ $t("login.confirmPassword") }}</label>
            <t-input
              v-model="registerForm.confirmPassword"
              type="password"
              :placeholder="$t('login.confirmPassword')"
              autocomplete="new-password"
              size="large"
            >
              <template #prefix-icon>
                <i-check-one theme="outline" size="18" />
              </template>
            </t-input>

            <label class="glass-field-label">{{ $t("login.inviteCode") }}</label>
            <t-input v-model="registerForm.inviteCode" :placeholder="$t('login.inviteCode')" autocomplete="off" size="large" clearable>
              <template #prefix-icon>
                <i-key theme="outline" size="18" />
              </template>
            </t-input>

            <t-button class="auth-primary-action" theme="primary" size="large" :loading="registerLoading" type="submit" block>
              {{ registerLoading ? $t("login.registering") : $t("login.register") }}
            </t-button>
          </form>

          <div class="auth-switch">
            <button v-if="authMode === 'login'" type="button" @click="switchAuthMode('register')">
              {{ $t("login.switchToRegister") }}
            </button>
            <button v-else type="button" @click="switchAuthMode('login')">
              {{ $t("login.switchToLogin") }}
            </button>
          </div>

          <div v-if="authMode === 'login'" class="tips">{{ $t("login.tips") }}</div>
        </section>
      </div>
    </main>

    <div class="auth-actions">
      <t-dropdown :options="langOptions" trigger="click" @click="handleChangeLang" :maxColumnWidth="150">
        <t-button shape="circle" theme="default" size="large" aria-label="Language">
          <template #icon>
            <i-translate theme="outline" size="20" />
          </template>
        </t-button>
      </t-dropdown>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import Router from "@/router/index.ts";
import axios from "@/utils/axios";
import settingStore from "@/stores/setting";
import { storeToRefs } from "pinia";
import { languageList, cachedLocale } from "@/locales";

const { locale, t } = useI18n();
const langOptions = languageList.map((item) => ({
  content: item.label,
  value: item.value,
}));

const handleChangeLang = (data) => {
  locale.value = data.value;
  cachedLocale.value = data.value;
};

const store = settingStore();
const { isElectron } = storeToRefs(store);

const authMode = ref("login");
const loginLoading = ref(false);
const registerLoading = ref(false);
const authNotice = ref({ type: "success", text: "" });
const loginForm = ref({
  username: "",
  password: "",
});
const registerForm = ref({
  username: "",
  password: "",
  confirmPassword: "",
  inviteCode: "",
});

const setNotice = (type, text) => {
  authNotice.value = { type, text };
};

const switchAuthMode = (mode) => {
  authMode.value = mode;
  setNotice("success", "");
};

const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    window.$message.warning(t("login.enterUsernameAndPassword"));
    return;
  }

  loginLoading.value = true;
  setNotice("success", "");
  try {
    const response = await axios.post("/login/login", { ...loginForm.value });
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("userId", response.data.id);
    window.$message.success(t("login.loginSuccess"));
    await Router.push("/project");
  } catch (e) {
    const message = e?.message || t("login.loginFailed");
    setNotice("error", message);
    window.$message.error(message);
  } finally {
    loginLoading.value = false;
  }
};

const handleRegister = async () => {
  const username = registerForm.value.username.trim();
  const { password, confirmPassword, inviteCode } = registerForm.value;

  if (!username) {
    window.$message.warning(t("login.usernameRequired"));
    return;
  }
  if (!password) {
    window.$message.warning(t("login.passwordRequired"));
    return;
  }
  if (password.length < 6) {
    setNotice("error", t("login.passwordTooShort"));
    return;
  }
  if (!confirmPassword) {
    window.$message.warning(t("login.confirmPasswordRequired"));
    return;
  }
  if (password !== confirmPassword) {
    setNotice("error", t("login.passwordMismatch"));
    return;
  }
  if (!inviteCode.trim()) {
    window.$message.warning(t("login.inviteCodeRequired"));
    return;
  }

  registerLoading.value = true;
  setNotice("success", "");
  try {
    await axios.post("/login/register", {
      username,
      password,
      confirmPassword,
      inviteCode: inviteCode.trim(),
    });
    loginForm.value.username = username;
    loginForm.value.password = "";
    registerForm.value.password = "";
    registerForm.value.confirmPassword = "";
    registerForm.value.inviteCode = "";
    switchAuthMode("login");
    await Router.replace("/login");
    setNotice("success", t("login.registerSuccess"));
    window.$message.success(t("login.registerSuccess"));
  } catch (e) {
    const message = e?.message || t("login.registerFailed");
    setNotice("error", message);
    window.$message.error(message);
  } finally {
    registerLoading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.loginPage {
  height: 100dvh;
  min-height: 620px;
  position: relative;
  overflow: auto;
  color: var(--td-text-color-primary);
  background:
    linear-gradient(115deg, rgba(82, 215, 255, 0.18) 0%, transparent 26% 74%, rgba(255, 191, 104, 0.1) 100%),
    linear-gradient(180deg, rgba(70, 232, 174, 0.08), transparent 38%),
    linear-gradient(135deg, #03060d 0%, #07111d 44%, #080a10 100%);

  &::before,
  &::after {
    position: fixed;
    inset: 0;
    pointer-events: none;
    content: "";
  }

  &::before {
    z-index: 0;
    background-image:
      linear-gradient(rgba(82, 215, 255, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(82, 215, 255, 0.08) 1px, transparent 1px);
    background-size: 42px 42px;
    opacity: 0.42;
    animation: auth-grid-drift 22s linear infinite;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.18) 86%);
  }

  &::after {
    z-index: 0;
    background:
      radial-gradient(ellipse at 50% 53%, rgba(70, 232, 174, 0.16), transparent 34%),
      repeating-linear-gradient(180deg, transparent 0 7px, rgba(243, 248, 255, 0.018) 8px 9px);
    opacity: 0.34;
  }
}

.auth-stage {
  min-height: 100%;
  padding: 48px 20px;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1200px;
}

.auth-ambient {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;

  &::before,
  &::after {
    position: absolute;
    content: "";
  }

  &::before {
    inset: -20% -12%;
    background:
      linear-gradient(115deg, transparent 0 26%, rgba(82, 215, 255, 0.1) 29%, transparent 33% 100%),
      linear-gradient(245deg, transparent 0 58%, rgba(255, 191, 104, 0.08) 61%, transparent 65% 100%);
    opacity: 0.5;
    transform: skewY(-7deg);
    animation: auth-light-sweep 12s ease-in-out infinite;
  }

  &::after {
    inset: 12% 6%;
    border: 1px solid rgba(82, 215, 255, 0.08);
    background-image:
      linear-gradient(90deg, rgba(82, 215, 255, 0.08) 1px, transparent 1px),
      linear-gradient(rgba(70, 232, 174, 0.055) 1px, transparent 1px);
    background-size: 124px 100%, 100% 86px;
    clip-path: polygon(9% 0, 100% 0, 91% 100%, 0 100%);
    opacity: 0.26;
    animation: auth-map-breathe 9s ease-in-out infinite;
  }
}

.auth-circuit,
.auth-data-rail,
.auth-scanline,
.auth-starfield,
.auth-orbit,
.auth-beam {
  position: absolute;
  display: block;
}

.auth-circuit {
  top: 14%;
  width: min(30vw, 420px);
  height: 72%;
  border-block: 1px solid rgba(82, 215, 255, 0.1);
  background:
    linear-gradient(90deg, rgba(82, 215, 255, 0.12) 1px, transparent 1px),
    linear-gradient(rgba(245, 171, 72, 0.08) 1px, transparent 1px);
  background-size: 56px 100%, 100% 72px;
  opacity: 0.24;
  filter: drop-shadow(0 0 22px rgba(82, 215, 255, 0.12));
  animation: auth-circuit-slide 15s ease-in-out infinite;
}

.auth-circuit-left {
  left: -7%;
  clip-path: polygon(0 0, 78% 0, 100% 100%, 16% 100%);
}

.auth-circuit-right {
  right: -7%;
  clip-path: polygon(22% 0, 100% 0, 82% 100%, 0 100%);
  animation-delay: -7s;
}

.auth-scanline {
  left: 0;
  right: 0;
  top: 18%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(82, 215, 255, 0.08), rgba(70, 232, 174, 0.44), rgba(255, 191, 104, 0.12), transparent);
  box-shadow: 0 0 24px rgba(82, 215, 255, 0.18);
  opacity: 0.42;
  animation: auth-scanline 9s cubic-bezier(0.64, 0, 0.36, 1) infinite;
}

.auth-data-rail {
  left: 50%;
  width: min(78vw, 980px);
  height: 1px;
  transform: translateX(-50%);
  background: linear-gradient(90deg, transparent, rgba(82, 215, 255, 0.26), rgba(255, 191, 104, 0.2), transparent);
  box-shadow: 0 0 24px rgba(82, 215, 255, 0.12);
}

.auth-data-rail-top {
  top: 13%;
  animation: auth-rail-pulse 7s ease-in-out infinite;
}

.auth-data-rail-bottom {
  bottom: 13%;
  animation: auth-rail-pulse 7s ease-in-out infinite reverse;
}

.auth-starfield {
  inset: 0;
  background-image:
    radial-gradient(circle at 12% 22%, rgba(137, 229, 255, 0.6) 0 1px, transparent 1.6px),
    radial-gradient(circle at 36% 72%, rgba(70, 232, 174, 0.36) 0 1px, transparent 1.8px),
    radial-gradient(circle at 74% 34%, rgba(255, 191, 104, 0.34) 0 1px, transparent 1.7px);
  background-size: 118px 118px, 174px 174px, 246px 246px;
  opacity: 0.3;
  filter: drop-shadow(0 0 10px rgba(82, 215, 255, 0.16));
  animation: auth-starfield-drift 28s linear infinite;
}

.auth-orbit {
  width: min(64vw, 880px);
  aspect-ratio: 1.9 / 1;
  left: 50%;
  top: 50%;
  border: 1px solid rgba(82, 215, 255, 0.1);
  border-radius: 999px;
  background:
    conic-gradient(from 90deg, transparent 0 12%, rgba(82, 215, 255, 0.34) 13%, transparent 15% 48%, rgba(255, 191, 104, 0.2) 50%, transparent 54% 100%),
    radial-gradient(ellipse at center, transparent 0 64%, rgba(70, 232, 174, 0.06) 65%, transparent 69%);
  box-shadow: inset 0 0 38px rgba(82, 215, 255, 0.04), 0 0 48px rgba(82, 215, 255, 0.06);
  opacity: 0.36;
  transform-origin: center;
}

.auth-orbit-one {
  transform: translate(-50%, -50%) rotate(-9deg);
  animation: auth-orbit-spin 28s linear infinite;
}

.auth-orbit-two {
  width: min(48vw, 650px);
  opacity: 0.28;
  transform: translate(-50%, -50%) rotate(18deg);
  animation: auth-orbit-spin-reverse 36s linear infinite;
}

.auth-beam {
  top: -10%;
  width: min(13vw, 180px);
  height: 120%;
  background:
    linear-gradient(90deg, transparent, rgba(82, 215, 255, 0.12), rgba(70, 232, 174, 0.08), transparent),
    repeating-linear-gradient(180deg, transparent 0 18px, rgba(137, 229, 255, 0.08) 19px 20px);
  opacity: 0.18;
  filter: blur(0.2px) drop-shadow(0 0 24px rgba(82, 215, 255, 0.14));
  transform: skewX(-18deg);
  animation: auth-beam-travel 11s ease-in-out infinite;
}

.auth-beam-left {
  left: 10%;
}

.auth-beam-right {
  right: 9%;
  animation-delay: -5.5s;
}

.auth-panel-wrap {
  width: min(520px, calc(100vw - 40px));
  position: relative;
  isolation: isolate;
  animation: auth-panel-enter 720ms cubic-bezier(0.16, 1, 0.3, 1) both;

  &::before,
  &::after {
    position: absolute;
    pointer-events: none;
    z-index: -1;
    content: "";
  }

  &::before {
    inset: -18px;
    border: 1px solid rgba(82, 215, 255, 0.24);
    background:
      conic-gradient(from 180deg, transparent 0 18%, rgba(82, 215, 255, 0.36) 24%, transparent 31% 58%, rgba(255, 191, 104, 0.28) 64%, transparent 72% 100%);
    clip-path: polygon(0 18px, 18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px));
    box-shadow: 0 0 42px rgba(82, 215, 255, 0.1);
    opacity: 0.58;
    animation: auth-frame-pulse 6s ease-in-out infinite;
  }

  &::after {
    inset: -34px -30px;
    background:
      linear-gradient(90deg, transparent, rgba(82, 215, 255, 0.07), transparent),
      linear-gradient(180deg, transparent, rgba(70, 232, 174, 0.055), transparent);
    filter: blur(18px);
    opacity: 0.72;
  }
}

.auth-card {
  padding: 30px 34px 26px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(82, 215, 255, 0.32);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(82, 215, 255, 0.1), transparent 32% 68%, rgba(255, 191, 104, 0.08)),
    linear-gradient(180deg, rgba(10, 18, 30, 0.96), rgba(7, 14, 25, 0.93));
  box-shadow:
    0 32px 90px rgba(0, 0, 0, 0.62),
    0 0 0 1px rgba(82, 215, 255, 0.08),
    0 0 46px rgba(82, 215, 255, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(22px) saturate(130%);

  &::before,
  &::after {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    content: "";
  }

  &::before {
    background: linear-gradient(115deg, transparent 0 34%, rgba(82, 215, 255, 0.11) 45%, rgba(70, 232, 174, 0.08) 52%, transparent 64% 100%);
    transform: translateX(-120%);
    animation: auth-card-sheen 7.5s ease-in-out infinite;
  }

  &::after {
    background:
      linear-gradient(90deg, rgba(82, 215, 255, 0.48) 0 64px, transparent 64px) left top / 108px 1px no-repeat,
      linear-gradient(180deg, rgba(82, 215, 255, 0.48) 0 64px, transparent 64px) left top / 1px 108px no-repeat,
      linear-gradient(270deg, rgba(255, 191, 104, 0.44) 0 64px, transparent 64px) right bottom / 108px 1px no-repeat,
      linear-gradient(0deg, rgba(255, 191, 104, 0.44) 0 64px, transparent 64px) right bottom / 1px 108px no-repeat;
    opacity: 0.58;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

.auth-card-hud {
  display: grid;
  grid-template-columns: 1fr 56px 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;

  span {
    display: block;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(82, 215, 255, 0.58), rgba(255, 191, 104, 0.28), transparent);
    box-shadow: 0 0 18px rgba(82, 215, 255, 0.2);
    animation: auth-hud-pulse 4.4s ease-in-out infinite;
  }

  span:nth-child(2) {
    height: 8px;
    border-radius: 999px;
    background:
      repeating-linear-gradient(90deg, rgba(82, 215, 255, 0.95) 0 5px, transparent 5px 10px),
      linear-gradient(90deg, transparent, rgba(70, 232, 174, 0.5), transparent);
    box-shadow: 0 0 18px rgba(82, 215, 255, 0.38), 0 0 28px rgba(70, 232, 174, 0.18);
    animation: auth-hud-core 3.8s steps(5) infinite;
  }
}

.brand-block {
  text-align: center;
  margin-bottom: 22px;

  .brand-mark {
    width: 58px;
    height: 58px;
    margin: 0 auto 12px;
    background: linear-gradient(135deg, var(--tf-accent), #9deeff 64%, var(--tf-accent-warm));
    mask: url("@/assets/logo.svg") no-repeat center;
    mask-size: contain;
    -webkit-mask: url("@/assets/logo.svg") no-repeat center;
    -webkit-mask-size: contain;
    filter: drop-shadow(0 0 18px rgba(70, 232, 174, 0.32));
  }

  h1 {
    margin: 0;
    font-size: 38px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0;
  }

  p {
    margin: 8px 0 0;
    color: var(--td-text-color-secondary);
    font-size: 14px;
  }
}

.auth-title {
  color: transparent;
  background: linear-gradient(90deg, #f7fbff, #9deeff, #46e8ae, #f7fbff);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: auth-title-flow 7s linear infinite;
}

.auth-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 5px;
  margin-bottom: 22px;
  border: 1px solid rgba(82, 215, 255, 0.16);
  border-radius: 10px;
  background: rgba(2, 8, 14, 0.46);

  button {
    height: 34px;
    border: 0;
    border-radius: 7px;
    color: var(--td-text-color-secondary);
    background: transparent;
    font-weight: 700;
    cursor: pointer;
    transition: color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;

    &.active {
      color: #03100f;
      background: linear-gradient(135deg, var(--tf-accent), #7bc8ff);
      box-shadow: 0 10px 22px rgba(32, 233, 212, 0.16);
    }
  }
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .glass-field-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--td-text-color-secondary);
    font-size: 13px;
    font-weight: 650;

    &::before {
      width: 7px;
      height: 7px;
      border: 1px solid rgba(82, 215, 255, 0.68);
      box-shadow: 0 0 12px rgba(82, 215, 255, 0.3);
      transform: rotate(45deg);
      content: "";
    }
  }

  :deep(.t-input) {
    height: 44px;
    border-color: rgba(82, 215, 255, 0.16) !important;
    border-radius: 10px !important;
    background: rgba(3, 8, 14, 0.54) !important;
    box-shadow: inset 0 0 0 1px rgba(148, 199, 255, 0.16);
  }

  :deep(.t-input.t-is-focused) {
    border-color: rgba(65, 221, 201, 0.82) !important;
    box-shadow: 0 0 0 3px rgba(65, 221, 201, 0.14), inset 0 0 0 1px rgba(65, 221, 201, 0.28) !important;
  }

  :deep(.t-input__prefix-icon) {
    color: var(--td-text-color-secondary);
  }
}

.auth-primary-action {
  height: 44px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 10px !important;
  font-weight: 800;
  background-size: 220% 100% !important;
  animation: auth-action-flow 6s ease-in-out infinite;

  &::after {
    opacity: 0.54;
    animation: auth-action-sheen 4.8s ease-in-out infinite;
  }
}

.auth-message {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;

  &.success {
    color: #8df7ce;
    border: 1px solid rgba(70, 232, 174, 0.24);
    background: rgba(70, 232, 174, 0.08);
  }

  &.error {
    color: #ffb4c0;
    border: 1px solid rgba(255, 111, 134, 0.26);
    background: rgba(255, 111, 134, 0.08);
  }
}

.auth-switch {
  margin-top: 18px;
  text-align: center;

  button {
    border: 0;
    color: var(--tf-accent);
    background: transparent;
    font-weight: 700;
    cursor: pointer;

    &:hover {
      color: #9deeff;
    }
  }
}

.tips {
  color: var(--td-text-color-secondary);
  opacity: 0.74;
  font-size: 12px;
  text-align: center;
  margin-top: 14px;
}

.auth-actions {
  position: fixed;
  right: max(24px, env(safe-area-inset-right));
  bottom: max(96px, calc(env(safe-area-inset-bottom) + 96px));
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@keyframes auth-grid-drift {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 42px 42px;
  }
}

@keyframes auth-light-sweep {
  0%,
  100% {
    transform: translateX(-4%) skewY(-7deg);
    opacity: 0.36;
  }

  50% {
    transform: translateX(4%) skewY(-7deg);
    opacity: 0.58;
  }
}

@keyframes auth-map-breathe {
  0%,
  100% {
    opacity: 0.22;
    transform: scale(0.99);
  }

  50% {
    opacity: 0.36;
    transform: scale(1.01);
  }
}

@keyframes auth-circuit-slide {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.18;
  }

  50% {
    transform: translateY(-28px);
    opacity: 0.3;
  }
}

@keyframes auth-scanline {
  0% {
    transform: translateY(-18vh);
    opacity: 0;
  }

  18%,
  82% {
    opacity: 0.42;
  }

  100% {
    transform: translateY(78vh);
    opacity: 0;
  }
}

@keyframes auth-rail-pulse {
  0%,
  100% {
    opacity: 0.18;
    transform: translateX(-50%) scaleX(0.76);
  }

  50% {
    opacity: 0.48;
    transform: translateX(-50%) scaleX(1);
  }
}

@keyframes auth-starfield-drift {
  from {
    background-position: 0 0, 0 0, 0 0;
    opacity: 0.24;
  }

  50% {
    opacity: 0.42;
  }

  to {
    background-position: 118px -118px, -174px 174px, 246px 246px;
    opacity: 0.24;
  }
}

@keyframes auth-orbit-spin {
  from {
    transform: translate(-50%, -50%) rotate(-9deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(351deg);
  }
}

@keyframes auth-orbit-spin-reverse {
  from {
    transform: translate(-50%, -50%) rotate(18deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(-342deg);
  }
}

@keyframes auth-beam-travel {
  0%,
  100% {
    opacity: 0.16;
    transform: translateX(-18px) skewX(-18deg);
  }

  50% {
    opacity: 0.34;
    transform: translateX(18px) skewX(-18deg);
  }
}

@keyframes auth-panel-enter {
  from {
    opacity: 0;
    transform: translateY(28px) rotateX(4deg) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) rotateX(0deg) scale(1);
  }
}

@keyframes auth-frame-pulse {
  0%,
  100% {
    opacity: 0.38;
    transform: scale(0.995);
  }

  50% {
    opacity: 0.68;
    transform: scale(1.006);
  }
}

@keyframes auth-hud-pulse {
  0%,
  100% {
    opacity: 0.42;
  }

  50% {
    opacity: 0.82;
  }
}

@keyframes auth-hud-core {
  0%,
  100% {
    opacity: 0.52;
    background-position: 0 0;
  }

  50% {
    opacity: 0.9;
    background-position: 18px 0;
  }
}

@keyframes auth-card-sheen {
  0%,
  24% {
    transform: translateX(-120%);
  }

  44%,
  100% {
    transform: translateX(120%);
  }
}

@keyframes auth-title-flow {
  from {
    background-position: 0% 50%;
  }

  to {
    background-position: 220% 50%;
  }
}

@keyframes auth-action-flow {
  0%,
  100% {
    background-position: 0% 50%;
    box-shadow: 0 8px 22px rgba(32, 233, 212, 0.2);
  }

  50% {
    background-position: 100% 50%;
    box-shadow: 0 14px 32px rgba(123, 200, 255, 0.24);
  }
}

@keyframes auth-action-sheen {
  0%,
  35% {
    transform: translateX(-120%);
  }

  58%,
  100% {
    transform: translateX(120%);
  }
}

@media (max-width: 640px) {
  .loginPage {
    min-height: 680px;
  }

  .auth-stage {
    align-items: flex-start;
    padding: 28px 16px 104px;
  }

  .auth-panel-wrap {
    width: min(100%, calc(100vw - 32px));
  }

  .auth-card {
    padding: 24px 20px 22px;
  }

  .brand-block h1 {
    font-size: 34px;
  }

  .auth-actions {
    right: 16px;
    bottom: 76px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loginPage::before,
  .auth-ambient::before,
  .auth-ambient::after,
  .auth-circuit,
  .auth-scanline,
  .auth-data-rail,
  .auth-starfield,
  .auth-orbit,
  .auth-beam,
  .auth-panel-wrap,
  .auth-panel-wrap::before,
  .auth-card::before,
  .auth-card-hud span,
  .auth-title,
  .auth-primary-action,
  .auth-primary-action::after {
    animation: none !important;
  }
}
</style>
