/**
 * A very small arithmetic language, for chart formulas written in the editor.
 *
 * The obvious implementation is `new Function('x', 'return ' + formula)`, and in a project
 * where formulas live in source files that would be fine — the author edits code already.
 * Here a formula arrives in `content/*.json`, which the editor can write and which the
 * path allowlist exists to keep free of code. Running it as JavaScript would hand the
 * editor arbitrary execution through the one door built to prevent it.
 *
 * So this parses and evaluates the expression itself. Numbers, the five operators, `^`,
 * parentheses, the variable, and the handful of functions below. There is no identifier
 * lookup beyond that table, no property access, no calls to anything else.
 */

type Fn = (...args: number[]) => number;

const FUNCTIONS: Record<string, Fn> = {
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  sqrt: Math.sqrt,
  pow: Math.pow,
  exp: Math.exp,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
};

export const FORMULA_FUNCTIONS = Object.keys(FUNCTIONS);

type Token = { kind: 'num'; value: number } | { kind: 'name'; value: string } | { kind: 'op'; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const start = i;
      while (i < input.length && /[0-9._]/.test(input[i])) i++;
      const value = Number(input.slice(start, i).replace(/_/g, ''));
      if (!Number.isFinite(value)) throw new Error(`"${input.slice(start, i)}" isn't a number`);
      tokens.push({ kind: 'num', value });
    } else if (/[a-zA-Z]/.test(c)) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9]/.test(input[i])) i++;
      tokens.push({ kind: 'name', value: input.slice(start, i) });
    } else if ('+-*/%^(),'.includes(c)) {
      tokens.push({ kind: 'op', value: c });
      i++;
    } else {
      throw new Error(`"${c}" isn't something a formula can contain`);
    }
  }
  return tokens;
}

const BINARY: Record<string, { precedence: number; right?: boolean; apply: (a: number, b: number) => number }> = {
  '+': { precedence: 1, apply: (a, b) => a + b },
  '-': { precedence: 1, apply: (a, b) => a - b },
  '*': { precedence: 2, apply: (a, b) => a * b },
  '/': { precedence: 2, apply: (a, b) => a / b },
  '%': { precedence: 2, apply: (a, b) => a % b },
  '^': { precedence: 3, right: true, apply: (a, b) => a ** b },
};

/**
 * Evaluates `formula` with `x` bound to the given value. Throws with a readable message
 * when the expression doesn't parse, which the caller turns into a note on the chart
 * rather than a failed build.
 */
export function evaluateFormula(formula: string, x: number): number {
  const tokens = tokenize(formula);
  let pos = 0;

  const peek = () => tokens[pos];
  const eat = (value: string) => {
    const token = peek();
    if (!token || token.kind !== 'op' || token.value !== value) throw new Error(`expected "${value}"`);
    pos++;
  };

  const parseExpression = (minPrecedence = 0): number => {
    let left = parseUnary();
    for (;;) {
      const token = peek();
      if (!token || token.kind !== 'op') break;
      const op = BINARY[token.value];
      if (!op || op.precedence < minPrecedence) break;
      pos++;
      const right = parseExpression(op.right ? op.precedence : op.precedence + 1);
      left = op.apply(left, right);
    }
    return left;
  };

  const parseUnary = (): number => {
    const token = peek();
    if (token?.kind === 'op' && (token.value === '-' || token.value === '+')) {
      pos++;
      const value = parseUnary();
      return token.value === '-' ? -value : value;
    }
    return parsePrimary();
  };

  const parsePrimary = (): number => {
    const token = peek();
    if (!token) throw new Error('the formula ends too early');
    if (token.kind === 'num') {
      pos++;
      return token.value;
    }
    if (token.kind === 'name') {
      pos++;
      if (token.value === 'x') return x;
      const fn = FUNCTIONS[token.value];
      if (!fn) throw new Error(`"${token.value}" isn't a name a formula knows`);
      eat('(');
      const args: number[] = [];
      if (!(peek()?.kind === 'op' && peek()?.value === ')')) {
        args.push(parseExpression());
        while (peek()?.kind === 'op' && peek()?.value === ',') {
          pos++;
          args.push(parseExpression());
        }
      }
      eat(')');
      return fn(...args);
    }
    if (token.value === '(') {
      pos++;
      const value = parseExpression();
      eat(')');
      return value;
    }
    throw new Error(`"${token.value}" can't start a value`);
  };

  const result = parseExpression();
  if (pos < tokens.length) throw new Error('there is something left over at the end');
  if (!Number.isFinite(result)) throw new Error('the result is not a finite number');
  return result;
}

export interface ChartRange {
  from: number;
  to: number;
  step?: number;
}

/** Every x the range covers, capped so a careless step can't produce a million points. */
export function rangeValues({ from, to, step }: ChartRange): number[] {
  const size = Math.abs(step || 1) || 1;
  const direction = to >= from ? 1 : -1;
  const count = Math.min(Math.floor(Math.abs(to - from) / size) + 1, 500);
  return Array.from({ length: count }, (_, i) => from + direction * i * size);
}
