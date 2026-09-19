import type { Script } from "./catalog.ts";
import { adjacentAddStep, filterVisible, type AddStep } from "./picker.ts";
import type { VisibleScript } from "./visible.ts";

export type ScriptDraft = {
  name: string;
  run: string;
  cwd: string;
  scope: "global" | "workspace";
  clonePath: string;
};

export type Session = {
  mode: "list" | AddStep | "confirm-delete";
  query: string;
  selected: number;
  draft: { name: string; run: string; cwd: string; scope: "workspace" | "global" };
  editingIndex: number | null;
  editingOriginal: Script | null;
  pendingDelete: { index: number; name: string; extra: string; original: Script } | null;
  visible: VisibleScript[];
  hasWorkspace: boolean;
};

export type SessionEffect =
  | { type: "none" }
  | { type: "quit" }
  | { type: "launch"; script: Script }
  | { type: "persist-add"; draft: ScriptDraft }
  | { type: "persist-edit"; index: number; original: Script; draft: ScriptDraft }
  | { type: "persist-delete"; index: number; original: Script };

export function createSession(visible: VisibleScript[], hasWorkspace: boolean): Session {
  return {
    mode: "list",
    query: "",
    selected: 0,
    draft: emptyDraft(hasWorkspace),
    editingIndex: null,
    editingOriginal: null,
    pendingDelete: null,
    visible,
    hasWorkspace,
  };
}

export function catalogScriptFromVisible(script: VisibleScript): Script {
  const next: Script = {
    name: script.name,
    kind: script.kind,
    run: script.run,
  };
  if (script.when && script.when.length > 0) {
    next.when = script.when;
  }
  if (script.cwd) {
    next.cwd = script.cwd;
  }
  return next;
}

export function handleSessionKey(
  session: Session,
  key: string,
  ctx: { clonePath: string },
): { session: Session; effect: SessionEffect } {
  if (key === "unbound") {
    return { session, effect: { type: "none" } };
  }
  if (session.mode === "confirm-delete") {
    return handleConfirm(session, key);
  }
  if (session.mode !== "list") {
    return handleForm(session, key, ctx);
  }
  return handleList(session, key, ctx);
}

function emptyDraft(hasWorkspace: boolean): Session["draft"] {
  return {
    name: "",
    run: "",
    cwd: "",
    scope: hasWorkspace ? "workspace" : "global",
  };
}

function draftInput(session: Session, clonePath: string): ScriptDraft {
  return {
    name: session.draft.name,
    run: session.draft.run,
    cwd: session.draft.cwd,
    scope: session.draft.scope,
    clonePath,
  };
}

function backToList(session: Session): Session {
  return {
    ...session,
    mode: "list",
    query: "",
    selected: 0,
    editingIndex: null,
    editingOriginal: null,
    pendingDelete: null,
    draft: emptyDraft(session.hasWorkspace),
  };
}

function persistEffect(
  session: Session,
  ctx: { clonePath: string },
): { session: Session; effect: SessionEffect } {
  const draft = draftInput(session, ctx.clonePath);
  if (session.editingIndex !== null && session.editingOriginal) {
    return {
      session: backToList(session),
      effect: {
        type: "persist-edit",
        index: session.editingIndex,
        original: session.editingOriginal,
        draft,
      },
    };
  }
  return {
    session: backToList(session),
    effect: { type: "persist-add", draft },
  };
}

function handleConfirm(session: Session, key: string): { session: Session; effect: SessionEffect } {
  if (key === "ctrl-c") {
    return { session, effect: { type: "quit" } };
  }
  if (key === "escape") {
    return { session: { ...session, mode: "list", pendingDelete: null }, effect: { type: "none" } };
  }
  if (key === "enter" && session.pendingDelete) {
    return {
      session: backToList(session),
      effect: {
        type: "persist-delete",
        index: session.pendingDelete.index,
        original: session.pendingDelete.original,
      },
    };
  }
  return { session, effect: { type: "none" } };
}

function handleForm(
  session: Session,
  key: string,
  ctx: { clonePath: string },
): { session: Session; effect: SessionEffect } {
  if (key === "ctrl-c") {
    return { session, effect: { type: "quit" } };
  }
  if (key === "escape") {
    return {
      session: {
        ...session,
        mode: "list",
        editingIndex: null,
        editingOriginal: null,
        draft: emptyDraft(session.hasWorkspace),
      },
      effect: { type: "none" },
    };
  }
  if (key === "up") {
    return { session: { ...session, mode: adjacentAddStep(session.mode as AddStep, -1) }, effect: { type: "none" } };
  }
  if (key === "down") {
    return { session: { ...session, mode: adjacentAddStep(session.mode as AddStep, 1) }, effect: { type: "none" } };
  }
  if (session.mode === "scope" && (key === "left" || key === "right" || key === "g" || key === "w")) {
    let scope = session.draft.scope;
    if (key === "g") {
      scope = "global";
    } else if (key === "w") {
      scope = "workspace";
    } else {
      scope = scope === "global" ? "workspace" : "global";
    }
    return { session: { ...session, draft: { ...session.draft, scope } }, effect: { type: "none" } };
  }
  if (key === "enter") {
    if (session.mode === "name" && session.draft.name.trim()) {
      return { session: { ...session, mode: "run" }, effect: { type: "none" } };
    }
    if (session.mode === "run" && session.draft.run.trim()) {
      return { session: { ...session, mode: "cwd" }, effect: { type: "none" } };
    }
    if (session.mode === "cwd") {
      if (!session.hasWorkspace) {
        return persistEffect(
          { ...session, draft: { ...session.draft, scope: "global" } },
          ctx,
        );
      }
      return { session: { ...session, mode: "scope" }, effect: { type: "none" } };
    }
    if (session.mode === "scope" && session.draft.name.trim() && session.draft.run.trim()) {
      return persistEffect(session, ctx);
    }
    return { session, effect: { type: "none" } };
  }
  if (session.mode === "name") {
    return {
      session: { ...session, draft: { ...session.draft, name: editField(session.draft.name, key) } },
      effect: { type: "none" },
    };
  }
  if (session.mode === "run") {
    return {
      session: { ...session, draft: { ...session.draft, run: editField(session.draft.run, key) } },
      effect: { type: "none" },
    };
  }
  if (session.mode === "cwd") {
    return {
      session: { ...session, draft: { ...session.draft, cwd: editField(session.draft.cwd, key) } },
      effect: { type: "none" },
    };
  }
  return { session, effect: { type: "none" } };
}

function handleList(
  session: Session,
  key: string,
  _ctx: { clonePath: string },
): { session: Session; effect: SessionEffect } {
  const visible = filterVisible(session.visible, session.query);
  const addIndex = visible.length;
  const selected = Math.min(session.selected, addIndex);

  if (key === "escape" || key === "ctrl-c") {
    return { session, effect: { type: "quit" } };
  }
  if (key === "+") {
    return { session: startAdd(session), effect: { type: "none" } };
  }
  if (key === "ctrl-e") {
    const chosen = visible[selected];
    if (chosen) {
      return { session: startEdit(session, chosen), effect: { type: "none" } };
    }
    return { session, effect: { type: "none" } };
  }
  if (key === "ctrl-d" || key === "delete") {
    const chosen = visible[selected];
    if (chosen) {
      return { session: startDelete(session, chosen), effect: { type: "none" } };
    }
    return { session, effect: { type: "none" } };
  }
  if (key === "enter") {
    if (selected === addIndex) {
      return { session: startAdd(session), effect: { type: "none" } };
    }
    const chosen = visible[selected];
    if (chosen) {
      return { session, effect: { type: "launch", script: catalogScriptFromVisible(chosen) } };
    }
    return { session, effect: { type: "none" } };
  }
  if (key === "up") {
    return { session: { ...session, selected: Math.max(0, selected - 1) }, effect: { type: "none" } };
  }
  if (key === "down") {
    return { session: { ...session, selected: Math.min(addIndex, selected + 1) }, effect: { type: "none" } };
  }
  if (/^[1-9]$/.test(key) && session.query.length === 0) {
    const chosen = session.visible[Number(key) - 1];
    if (chosen) {
      return { session, effect: { type: "launch", script: catalogScriptFromVisible(chosen) } };
    }
    return { session, effect: { type: "none" } };
  }
  if (key === "backspace") {
    return { session: { ...session, query: session.query.slice(0, -1), selected: 0 }, effect: { type: "none" } };
  }
  if (key.length === 1 && !key.startsWith("\u001b")) {
    return { session: { ...session, query: session.query + key, selected: 0 }, effect: { type: "none" } };
  }
  return { session, effect: { type: "none" } };
}

function startAdd(session: Session): Session {
  return {
    ...session,
    mode: "name",
    editingIndex: null,
    editingOriginal: null,
    draft: emptyDraft(session.hasWorkspace),
  };
}

function startEdit(session: Session, chosen: VisibleScript): Session {
  return {
    ...session,
    mode: "name",
    editingIndex: chosen.catalogIndex,
    editingOriginal: catalogScriptFromVisible(chosen),
    draft: {
      name: chosen.name,
      run: typeof chosen.run === "string" ? chosen.run : chosen.run.join(" "),
      cwd: chosen.cwd ?? "",
      scope: chosen.when && chosen.when.length > 0 ? "workspace" : "global",
    },
  };
}

function startDelete(session: Session, chosen: VisibleScript): Session {
  return {
    ...session,
    mode: "confirm-delete",
    pendingDelete: {
      index: chosen.catalogIndex,
      name: chosen.name,
      extra: chosen.disambiguator ?? "",
      original: catalogScriptFromVisible(chosen),
    },
  };
}

function editField(value: string, key: string): string {
  if (key === "backspace") {
    return value.slice(0, -1);
  }
  if (key.length === 1 && !key.startsWith("\u001b")) {
    return value + key;
  }
  return value;
}
