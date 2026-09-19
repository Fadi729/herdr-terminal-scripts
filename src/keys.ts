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

  if (buffer.startsWith("\u001b[A") || buffer.startsWith("\u001bOA")) {
    return { key: "up", rest: buffer.slice(3), pending: false };
  }
  if (buffer.startsWith("\u001b[B") || buffer.startsWith("\u001bOB")) {
    return { key: "down", rest: buffer.slice(3), pending: false };
  }
  if (buffer.startsWith("\u001b[C") || buffer.startsWith("\u001bOC")) {
    return { key: "right", rest: buffer.slice(3), pending: false };
  }
  if (buffer.startsWith("\u001b[D") || buffer.startsWith("\u001bOD")) {
    return { key: "left", rest: buffer.slice(3), pending: false };
  }
  if (buffer.startsWith("\u001b[3~")) {
    return { key: "delete", rest: buffer.slice(4), pending: false };
  }

  if (buffer === "\u001b" || buffer === "\u001b[" || buffer === "\u001bO" || buffer === "\u001b[3") {
    return { key: null, rest: buffer, pending: true };
  }

  if (buffer.startsWith("\u001b\u001b")) {
    return { key: "escape", rest: buffer.slice(2), pending: false };
  }

  return { key: "escape", rest: buffer.slice(1), pending: false };
}

export function flushPending(buffer: string): { key: string | null; rest: string } {
  if (buffer.startsWith("\u001b")) {
    return { key: "escape", rest: buffer.slice(1) };
  }
  return { key: null, rest: buffer };
}
