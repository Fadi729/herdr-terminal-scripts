# Terminal Scripts

A [Herdr](https://herdr.dev) plugin that runs named Scripts from a popup or a numbered Slot.

Needs Herdr 0.9+ and Node 20+ on macOS or Linux, with `node` and `npm` on `PATH`.

## Install

```bash
herdr plugin install Fadi729/herdr-terminal-scripts
```

Scripts are stored in the plugin config dir:

```bash
herdr plugin config-dir terminal-scripts
```

Remove the plugin with:

```bash
herdr plugin uninstall terminal-scripts
```

## Daily use

Focus a Herdr workspace and open the popup:

```bash
herdr plugin action invoke terminal-scripts.picker
```

You can also bind a key. See [Hotkeys](#hotkeys).


| Key              | Action                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Type             | Filter Visible Scripts by name                                       |
| ↑ / ↓            | Move the selection                                                   |
| Enter            | Run the selected Script, or start Add Script if that row is selected |
| `1`–`9`          | Run that Slot (the Nth Visible Script)                               |
| `+`              | Add a Script                                                         |
| Ctrl+E           | Edit the selected Script                                             |
| Ctrl+D or Delete | Delete the selected Script, after a confirm step                     |
| Esc              | Close                                                                |


A run opens a new tab named after the Script and runs there. `cwd` is passed to `tab create --cwd`, so the tab’s shell starts in that directory; the Script is then typed into that shell. If cwd is empty, the tab uses the workspace cwd.

### Add a Script

1. Press `+`, or select Add Script and press Enter.
2. Fill `Name`, `Command`, optional `cwd`, and `Scope`. ↑ and ↓ move between fields. ← and →, or `w` and `g`, switch `Scope` between `This workspace` and `Everywhere`.
3. Press Enter on `Scope` to save. Esc returns to the list.

Leave `cwd` empty to run at the workspace root. A relative path such as `apps/web` is resolved against the workspace cwd.

`Scope` is `This workspace` or `Everywhere`:

- `This workspace`: the popup lists the new script only in this clone, including git worktrees of that clone. A second clone of the same GitHub repo will not list it.
- `Everywhere`: the popup lists the Script in every workspace.

The popup writes `scripts.json` in the config dir. Hand-edit that file for `exec` or `herdr` Kinds.

### Edit or delete a Script

1. Select the Script, not the Add row.
2. Ctrl+E opens the same form, filled in. Enter on Scope saves. Esc cancels.
3. Ctrl+D or Delete asks for confirmation. Enter removes the Script from the Catalog. Esc cancels.

Edit and delete change that Catalog row, so two Scripts with the same Name stay distinct. Changing Command only applies when `run` is a string. `herdr` and argv `exec` keep their `run`. You can always change cwd.

### Slots without the popup

```bash
herdr plugin action invoke terminal-scripts.run-1
```

`run-1` through `run-9` launch the Nth Visible Script for the active workspace. Slot 1 in one repo is not Slot 1 in another.

## Hotkeys

Add these to `~/.config/herdr/config.toml`, then run `herdr server reload-config`:

```toml
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
```

Copy the `ctrl+1` block for `run-2` through `run-9` if you want numbered shortcuts.

## Catalog

All Scripts live in one JSON file in the plugin config dir:

```text
$(herdr plugin config-dir terminal-scripts)/scripts.json
```

The popup creates and updates this file. You can also edit it by hand for `exec` / `herdr` Kinds, extra matchers, or a per-Script cwd.

```json
{
  "scripts": [
    {
      "name": "Herdr logs",
      "kind": "herdr",
      "run": ["plugin", "log", "list"]
    },
    {
      "name": "Dev server",
      "kind": "shell",
      "run": "pnpm dev",
      "when": [{ "path": "~/Projects/app" }],
      "cwd": "apps/web"
    }
  ]
}
```


| Field  | Meaning                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| `name` | Label in the popup. Names may repeat.                                                                      |
| `kind` | `shell` (snippet typed into the new tab’s shell), `exec` (path or argv), or `herdr` (argv appended to the Herdr binary). |
| `run`  | String for `shell`, string or argv for `exec`, argv for `herdr`.                                           |
| `when` | Omit for Global. Otherwise `{ "path": "…" }` for this clone or folder. `~` expands to `$HOME`.             |
| `cwd`  | Optional. Relative paths resolve against the workspace cwd. Absolute paths are used as written.            |


A Scoped Script is Visible when the workspace cwd is that path or under it, or when the workspace is a git worktree of that clone. A second clone of the same GitHub repo is a different Matcher unless you list both paths.

The popup lists Scoped Scripts in Catalog order, then Global Scripts in Catalog order. If two Visible Scripts share a Name, the list shows the Matcher or `global`.

A missing file is an empty Catalog. You can still Add. Invalid JSON is shown in the popup. Slots notify and do not launch.

## Troubleshooting

```bash
herdr plugin list --plugin terminal-scripts
herdr plugin log list --plugin terminal-scripts
herdr plugin action list --plugin terminal-scripts
```

**Empty popup.** Add a Script, or check that `scripts.json` is in the config dir above.

**Scoped Script missing.** The active workspace is not that clone or a worktree of it. Check `when.path`.

**Plugin not found.** Run `herdr plugin install Fadi729/herdr-terminal-scripts` again.