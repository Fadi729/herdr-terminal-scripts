Copy this file to the plugin config dir as `scripts.json`:

  herdr plugin config-dir terminal-scripts

Global Scripts omit `when`. Scoped Scripts list clone paths; worktrees of that clone match, a second clone does not.

Bind in `~/.config/herdr/config.toml`:

  [[keys.command]]
  key = "prefix+s"
  type = "plugin_action"
  command = "terminal-scripts.picker"
  description = "open Script popup"

  [[keys.command]]
  key = "ctrl+1"
  type = "plugin_action"
  command = "terminal-scripts.run-1"
  description = "run Script slot 1"
