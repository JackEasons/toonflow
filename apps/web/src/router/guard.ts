import type { Router } from "vue-router";

const LOGIN_PATH = "/login";
const TOKEN_STORAGE_KEY = "token";

function hasAccessToken() {
  return Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));
}

function setupAccessGuard(router: Router) {
  router.beforeEach((to) => {
    if (to.path === LOGIN_PATH || hasAccessToken()) {
      return true;
    }

    return LOGIN_PATH;
  });
}

function createRouterGuard(router: Router) {
  setupAccessGuard(router);
}

export { createRouterGuard, LOGIN_PATH };
