type LinkClickHandler = (event: MouseEvent) => Promise<boolean>;

async function handleLinkClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();

  const target = event.currentTarget as HTMLAnchorElement | null;
  const url = target?.getAttribute("data-link") || target?.getAttribute("href");
  if (!url) return false;

  window.open(url, "_blank", "noopener,noreferrer");
  return false;
}

let setupPromise: Promise<void> | null = null;

export function setupMarkdownRenderer() {
  if (typeof window !== "undefined") {
    (window as unknown as Window & { handleLinkClick: LinkClickHandler }).handleLinkClick = handleLinkClick;
  }

  setupPromise ??= import("md-editor-v3").then(({ config }) => {
    config({
      markdownItConfig(md) {
        const defaultRender =
          md.renderer.rules.link_open ||
          function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
          };

        md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
          const token = tokens[idx];
          const href = token.attrGet("href");

          if (href) {
            token.attrSet("target", "_blank");
            token.attrSet("rel", "noopener noreferrer");
            token.attrSet("data-link", href);
            token.attrSet("onclick", "return handleLinkClick(event)");
          }

          return defaultRender(tokens, idx, options, env, self);
        };
      },
    });
  });

  return setupPromise;
}
