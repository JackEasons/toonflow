#!/bin/sh
set -eu

init_static_dir() {
  seed_dir="$1"
  target_dir="$2"

  mkdir -p "$target_dir"

  if [ -d "$seed_dir" ] && [ -z "$(find "$target_dir" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
    cp -a "$seed_dir"/. "$target_dir"/
  fi
}

init_static_dir "/opt/drama-studio/static/app" "/usr/share/nginx/html"
init_static_dir "/opt/drama-studio/static/admin" "/usr/share/nginx/admin"
