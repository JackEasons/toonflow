#!/bin/sh
set -eu

seed_dir="/opt/drama-studio/server-data"
data_dir="/app/apps/server/data"
serve_seed_dir="/opt/drama-studio/server-serve"
serve_dir="/app/apps/server/serve"

mkdir -p "$data_dir"

copy_if_missing() {
  source_path="$seed_dir/$1"
  target_path="$data_dir/$1"

  if [ -d "$source_path" ]; then
    mkdir -p "$target_path"
    if [ -z "$(find "$target_path" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
      cp -a "$source_path"/. "$target_path"/
    fi
  elif [ -e "$source_path" ] && [ ! -e "$target_path" ]; then
    cp -a "$source_path" "$target_path"
  fi
}

if [ -d "$seed_dir" ]; then
  copy_if_missing "assets"
  copy_if_missing "modelPrompt"
  copy_if_missing "models"
  copy_if_missing "oss"
  copy_if_missing "skills"
  copy_if_missing "vendor"
  copy_if_missing "mysql-init.sql"
  copy_if_missing "db2.sqlite"
fi

mkdir -p "$serve_dir"
if [ -d "$serve_seed_dir" ] && [ -z "$(find "$serve_dir" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
  cp -a "$serve_seed_dir"/. "$serve_dir"/
fi

exec "$@"
