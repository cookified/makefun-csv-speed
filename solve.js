const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

const QUOTE = 34;
const COMMA_CODE = 44;
const LF = 10;
const CR = 13;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  function readUnquoted(value) {
    let start = pos;
    let added = 0;
    while (pos < len) {
      const cc = text.charCodeAt(pos);
      if (cc === COMMA_CODE) {
        if (pos > start) {
          const piece = text.slice(start, pos);
          value += piece;
          added += piece.length;
        }
        pos += 1;
        return { value, ended: COMMA, added };
      }
      if (cc === LF) {
        if (pos > start) {
          const piece = text.slice(start, pos);
          value += piece;
          added += piece.length;
        }
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      if (cc === CR) {
        if (pos > start) {
          const piece = text.slice(start, pos);
          value += piece;
          added += piece.length;
        }
        if (pos + 1 < len && text.charCodeAt(pos + 1) === LF) {
          pos += 2;
          line += 1;
          return { value, ended: LINE_BREAK, added };
        }
        error('stray_cr');
        pos += 1;
        start = pos;
        continue;
      }
      pos += 1;
    }
    if (pos > start) {
      const piece = text.slice(start, pos);
      value += piece;
      added += piece.length;
    }
    return { value, ended: END, added };
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    let start = pos + 1;
    pos += 1;
    let closed = false;
    while (pos < len) {
      const cc = text.charCodeAt(pos);
      if (cc === QUOTE) {
        if (pos > start) value += text.slice(start, pos);
        if (pos + 1 < len && text.charCodeAt(pos + 1) === QUOTE) {
          value += '"';
          pos += 2;
          start = pos;
          continue;
        }
        pos += 1;
        closed = true;
        break;
      }
      if (cc === CR) {
        if (pos > start) value += text.slice(start, pos);
        value += '\n';
        line += 1;
        pos += pos + 1 < len && text.charCodeAt(pos + 1) === LF ? 2 : 1;
        start = pos;
        continue;
      }
      if (cc === LF) {
        if (pos > start) value += text.slice(start, pos);
        value += '\n';
        line += 1;
        pos += 1;
        start = pos;
        continue;
      }
      pos += 1;
    }
    if (!closed) {
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    if (pos >= len) return { value, ended: END, added: 0 };
    const cc = text.charCodeAt(pos);
    if (cc === COMMA_CODE) {
      pos += 1;
      return { value, ended: COMMA, added: 0 };
    }
    if (cc === LF) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK, added: 0 };
    }
    if (cc === CR && pos + 1 < len && text.charCodeAt(pos + 1) === LF) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK, added: 0 };
    }
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  while (true) {
    while (pos < len) {
      const cc = text.charCodeAt(pos);
      if (cc === LF) {
        pos += 1;
        line += 1;
      } else if (cc === CR && pos + 1 < len && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === QUOTE;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
