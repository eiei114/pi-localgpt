#!/usr/bin/env node
/**
 * Count top-level node:test cases under tests/*.test.mjs.
 *
 * Matches how `node --test tests/*.test.mjs` reports pass counts: only
 * top-level `test(` declarations are counted, not nested subtests.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const IDENT_START = /[a-zA-Z_$]/;
const IDENT_PART = /[\w$]/;

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  return index;
}

function skipLineComment(source, index) {
  index += 2;
  while (index < source.length && source[index] !== "\n") {
    index += 1;
  }
  return index;
}

function skipBlockComment(source, index) {
  index += 2;
  while (index < source.length - 1) {
    if (source[index] === "*" && source[index + 1] === "/") {
      return index + 2;
    }
    index += 1;
  }
  return source.length;
}

function skipString(source, index, quote) {
  index += 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) {
      return index + 1;
    }
    index += 1;
  }
  return source.length;
}

function skipTemplateLiteral(source, index) {
  index += 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === "`") {
      return index + 1;
    }
    if (source[index] === "$" && source[index + 1] === "{") {
      index += 2;
      index = skipExpression(source, index);
      continue;
    }
    index += 1;
  }
  return source.length;
}

function skipExpression(source, index) {
  let braceDepth = 1;
  while (index < source.length && braceDepth > 0) {
    index = skipToken(source, index);
    if (index >= source.length) {
      break;
    }

    const char = source[index];
    if (char === "{") {
      braceDepth += 1;
      index += 1;
      continue;
    }
    if (char === "}") {
      braceDepth -= 1;
      index += 1;
    }
  }
  return index;
}

function readIdentifier(source, index) {
  const start = index;
  index += 1;
  while (index < source.length && IDENT_PART.test(source[index])) {
    index += 1;
  }
  return [source.slice(start, index), index];
}

function isFunctionBodyOpener(source, index) {
  let cursor = skipWhitespace(source, index);
  if (source.startsWith("=>", cursor)) {
    cursor = skipWhitespace(source, cursor + 2);
    return source[cursor] === "{";
  }

  if (!source.startsWith("function", cursor)) {
    return false;
  }

  cursor += "function".length;
  if (cursor < source.length && IDENT_PART.test(source[cursor])) {
    return false;
  }

  cursor = skipWhitespace(source, cursor);
  if (source[cursor] === "*") {
    cursor = skipWhitespace(source, cursor + 1);
  }

  if (source[cursor] === "(") {
    let depth = 0;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
      } else if (char === '"' || char === "'" || char === "`") {
        cursor = char === "`"
          ? skipTemplateLiteral(source, cursor)
          : skipString(source, cursor, char);
        continue;
      } else if (source.startsWith("//", cursor)) {
        cursor = skipLineComment(source, cursor);
        continue;
      } else if (source.startsWith("/*", cursor)) {
        cursor = skipBlockComment(source, cursor);
        continue;
      }
      cursor += 1;
    }
  } else if (IDENT_START.test(source[cursor])) {
    [, cursor] = readIdentifier(source, cursor);
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] !== "(") {
      return false;
    }
    let depth = 0;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
      } else if (char === '"' || char === "'" || char === "`") {
        cursor = char === "`"
          ? skipTemplateLiteral(source, cursor)
          : skipString(source, cursor, char);
        continue;
      } else if (source.startsWith("//", cursor)) {
        cursor = skipLineComment(source, cursor);
        continue;
      } else if (source.startsWith("/*", cursor)) {
        cursor = skipBlockComment(source, cursor);
        continue;
      }
      cursor += 1;
    }
  } else {
    return false;
  }

  cursor = skipWhitespace(source, cursor);
  return source[cursor] === "{";
}

function skipToken(source, index) {
  index = skipWhitespace(source, index);
  if (index >= source.length) {
    return index;
  }

  const char = source[index];
  if (char === '"' || char === "'") {
    return skipString(source, index, char);
  }
  if (char === "`") {
    return skipTemplateLiteral(source, index);
  }
  if (source.startsWith("//", index)) {
    return skipLineComment(source, index);
  }
  if (source.startsWith("/*", index)) {
    return skipBlockComment(source, index);
  }

  return index + 1;
}

/**
 * Count module-level `test(` declarations in a JavaScript module source string.
 * Ignores nested callback tests, comments, and string/template-literal text.
 */
export function countTopLevelTestCalls(source) {
  let count = 0;
  let index = 0;
  const scopeStack = ["module"];
  let pendingFunctionBody = false;

  const inFunctionScope = () => scopeStack.includes("function");

  while (index < source.length) {
    index = skipWhitespace(source, index);
    if (index >= source.length) {
      break;
    }

    if (source.startsWith("//", index)) {
      index = skipLineComment(source, index);
      continue;
    }
    if (source.startsWith("/*", index)) {
      index = skipBlockComment(source, index);
      continue;
    }

    const char = source[index];
    if (char === '"' || char === "'") {
      index = skipString(source, index, char);
      continue;
    }
    if (char === "`") {
      index = skipTemplateLiteral(source, index);
      continue;
    }

    if (char === "{") {
      scopeStack.push(pendingFunctionBody ? "function" : "block");
      pendingFunctionBody = false;
      index += 1;
      continue;
    }

    if (char === "}") {
      if (scopeStack.length > 1) {
        scopeStack.pop();
      }
      index += 1;
      continue;
    }

    if (IDENT_START.test(char)) {
      const [ident, nextIndex] = readIdentifier(source, index);
      const afterIdent = skipWhitespace(source, nextIndex);

      if (ident === "test" && !inFunctionScope() && source[afterIdent] === "(") {
        count += 1;
      }

      if (isFunctionBodyOpener(source, nextIndex)) {
        pendingFunctionBody = true;
      }

      index = nextIndex;
      continue;
    }

    if (source.startsWith("=>", index)) {
      const afterArrow = skipWhitespace(source, index + 2);
      if (source[afterArrow] === "{") {
        pendingFunctionBody = true;
      }
      index += 2;
      continue;
    }

    index += 1;
  }

  return count;
}

export function countNodeTestCases(root = process.cwd()) {
  const testDir = join(root, "tests");
  const files = readdirSync(testDir).filter((file) => file.endsWith(".test.mjs"));

  return files.reduce((total, file) => {
    const source = readFileSync(join(testDir, file), "utf8");
    return total + countTopLevelTestCalls(source);
  }, 0);
}

function main() {
  const count = countNodeTestCases();
  console.log(`node-test-cases: ${count}`);
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main();
}
