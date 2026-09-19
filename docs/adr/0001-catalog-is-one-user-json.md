# Catalog is one user-owned JSON file

Scripts are personal launches, not repo artifacts. Storing them in the working tree would hide them from other clones on the same machine and force gitignore/commit debates. One `scripts.json` in the plugin config dir, with matchers on each Script, is the SuperSet “user settings” shape: a single file to edit, applicability decided at run time against the active workspace.
