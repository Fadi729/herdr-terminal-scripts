# Hotkeys bind to Visible Slots, not to named Scripts

Herdr plugin v1 cannot register actions at runtime, so a Catalog change cannot grow a new global keybinding. Per-Script keys would mean rewriting `herdr-plugin.toml` or the user’s Herdr config. One action opens the Popup; nine static actions (`run-1` … `run-9`) launch the Nth currently Visible Script, SuperSet’s Ctrl+1–9. The same Slot is a different Script when the workspace changes, which is what “hidden when not in scope” requires.
