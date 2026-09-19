# Terminal Scripts

A Herdr plugin that runs user-authored Scripts instantly from a popup or a hotkey, filtered to the active workspace.

## Language

**Script**:
A named, fully-specified launch the user authored. It has no id, no runtime arguments, and one Kind: a shell snippet, an executable, or a Herdr CLI sequence. **Name** is the Popup label; it is not unique.
_Avoid_: Command, action, task, preset, id

**Kind**:
How a Script is executed: shell (a snippet run by the user's shell), exec (a path to an executable), or herdr (a Herdr CLI sequence).
_Avoid_: Type, command type

**Catalog**:
The single user-owned JSON file of Scripts, stored outside any project repository. The plugin reads it and decides which Scripts are visible.
_Avoid_: Config, settings, registry

**Global Script**:
A Script with no workspace restriction; it is visible in every workspace.
_Avoid_: Default script

**Scoped Script**:
A Script that is visible only when the active workspace matches a restriction the user declared.
_Avoid_: Project script, per-repo script (those imply a file inside the repository)

**Matcher**:
An absolute path of a local clone or folder the user declared. The Script is visible when the active workspace cwd is that path or under it, or when the workspace is a git worktree of the repository at that path. A second clone of the same remote is a different Matcher unless listed as well. The plugin evaluates; it never infers Scripts from project files.
_Avoid_: Git identity, remote, project id, applies to, auto-detect

**Visible Script**:
A Script shown for the active workspace: every Global Script, plus every Scoped Script whose Matcher matches.
_Avoid_: Available command, filtered command

**Slot**:
The 1-based position of a Visible Script in the Popup list. Scoped matches come first, in Catalog order; Global Scripts follow, in Catalog order. Plugin actions `run-1` through `run-9` launch that Slot without opening the Popup.
_Avoid_: Hotkey, shortcut, index (those are how you press it, not what it is)

**Popup**:
The session-modal Herdr pane used to pick a Visible Script by search. When two Visible Scripts share a Name, the list also shows the Matcher, or that the Script is Global.
_Avoid_: Popscreen, palette, modal, scripts bar
