const CSI_FINAL_MIN = 0x40;
const CSI_FINAL_MAX = 0x7e;
const CSI_PARAM_MIN = 0x20;
const CSI_PARAM_MAX = 0x3f;

export function consumeKey(buffer: string): { key: string | null; rest: string; pending: boolean } {
  if (buffer.length === 0) {
    return { key: null, rest: "", pending: false };
  }

  if (buffer[0] !== "\u001b") {
    const char = buffer[0] ?? "";
    if (char === "\u0003") {
      return { key: "ctrl-c", rest: buffer.slice(1), pending: false };
    }
    if (char === "\u0004") {
      return { key: "ctrl-d", rest: buffer.slice(1), pending: false };
    }
    if (char === "\u0005") {
      return { key: "ctrl-e", rest: buffer.slice(1), pending: false };
    }
    if (char === "\r" || char === "\n") {
      return { key: "enter", rest: buffer.slice(1), pending: false };
    }
    if (char === "\u007f" || char === "\b") {
      return { key: "backspace", rest: buffer.slice(1), pending: false };
    }
    if (char === "\u0010") {
      return { key: "up", rest: buffer.slice(1), pending: false };
    }
    if (char === "\u000e") {
      return { key: "down", rest: buffer.slice(1), pending: false };
    }
    return { key: char, rest: buffer.slice(1), pending: false };
  }

  if (buffer === "\u001b") {
    return { key: null, rest: buffer, pending: true };
  }

  if (buffer.startsWith("\u001b\u001b")) {
    return { key: "escape", rest: buffer.slice(2), pending: false };
  }

  if (buffer[1] === "O") {
    if (buffer.length < 3) {
      return { key: null, rest: buffer, pending: true };
    }
    return { key: ss3Key(buffer.slice(0, 3)), rest: buffer.slice(3), pending: false };
  }

  if (buffer[1] === "[") {
    return consumeCsi(buffer);
  }

  return { key: "unbound", rest: buffer.slice(2), pending: false };
}

export function flushPending(buffer: string): { key: string | null; rest: string } {
  if (buffer.startsWith("\u001b")) {
    return { key: "escape", rest: buffer.slice(1) };
  }
  return { key: null, rest: buffer };
}

function consumeCsi(buffer: string): { key: string | null; rest: string; pending: boolean } {
  for (let i = 2; i < buffer.length; i++) {
    const code = buffer.charCodeAt(i);
    if (code >= CSI_FINAL_MIN && code <= CSI_FINAL_MAX) {
      const seq = buffer.slice(0, i + 1);
      return { key: csiKey(seq), rest: buffer.slice(i + 1), pending: false };
    }
    if (code < CSI_PARAM_MIN || code > CSI_PARAM_MAX) {
      return { key: "unbound", rest: buffer.slice(i), pending: false };
    }
  }
  return { key: null, rest: buffer, pending: true };
}

function ss3Key(seq: string): string {
  if (seq === "\u001bOA") {
    return "up";
  }
  if (seq === "\u001bOB") {
    return "down";
  }
  if (seq === "\u001bOC") {
    return "right";
  }
  if (seq === "\u001bOD") {
    return "left";
  }
  return "unbound";
}

function csiKey(seq: string): string {
  if (seq === "\u001b[A") {
    return "up";
  }
  if (seq === "\u001b[B") {
    return "down";
  }
  if (seq === "\u001b[C") {
    return "right";
  }
  if (seq === "\u001b[D") {
    return "left";
  }
  if (seq === "\u001b[3~") {
    return "delete";
  }
  return "unbound";
}
