#!/bin/bash

# Setup Git hooks for development

HOOKS_DIR="git-hooks"
GIT_HOOKS_DIR=".git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "Error: $HOOKS_DIR directory not found"
  exit 1
fi

mkdir -p "$GIT_HOOKS_DIR"

for hook in "$HOOKS_DIR"/*; do
  hook_name=$(basename "$hook")
  target="$GIT_HOOKS_DIR/$hook_name"

  cp "$hook" "$target"
  chmod +x "$target"

  echo "Installed: $hook_name"
done

echo "Git hooks setup complete"
