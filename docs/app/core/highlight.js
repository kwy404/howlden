// Copied from src/ by scripts/sync-core.mjs. Edit the file in src/ instead.
// A small syntax highlighter for code blocks in chat. It splits code into
// tokens (comment, string, number, keyword, function, punctuation) with one
// regular expression per family, so it is fast and never builds markup: the
// renderer makes one text node per token.

const KEYWORDS = {
  js: 'await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield async interface type enum implements readonly',
  py: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self',
  sh: 'if then else elif fi for while do done case esac in function return export local echo exit cd',
  css: 'important media supports keyframes from to and not only',
  sql: 'select from where and or not insert into values update set delete create table index join left right inner outer on group by order having limit offset as null is in like distinct primary key references',
  rust: 'as async await break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false',
};
const ALIAS = { javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', json: 'js', mjs: 'js', python: 'py', bash: 'sh', shell: 'sh', zsh: 'sh', scss: 'css', rs: 'rust', golang: 'go', c: 'js', cpp: 'js', java: 'js', cs: 'js', php: 'js', kotlin: 'js', swift: 'js' };
const HASH_COMMENTS = new Set(['py', 'sh']);

/** The language family for a fence label, or '' when it is unknown. */
export function langOf(label) {
  const l = String(label || '').toLowerCase();
  return KEYWORDS[l] ? l : ALIAS[l] || '';
}

/**
 * Tokens for a piece of code: [{ type, value }], where type is one of
 * 'com', 'str', 'num', 'kw', 'fn', 'punct' or '' (plain). Joining the values
 * gives back the code exactly. Unknown languages get the generic rules.
 */
export function highlight(code, label = '') {
  const lang = langOf(label);
  const words = new Set((KEYWORDS[lang] || KEYWORDS.js).split(' '));
  const comment = HASH_COMMENTS.has(lang) ? '#[^\\n]*' : lang === 'sql' ? '--[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|<!--[\\s\\S]*?-->';
  const re = new RegExp(`(${comment})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|(\\b(?:0x[\\da-f]+|\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)\\b)|([A-Za-z_$][\\w$]*)(?=(\\s*\\()?)|([{}()[\\];,.:=<>+\\-*/%!&|?^~])`, 'gi');
  const out = [];
  let last = 0;
  const push = (type, value) => {
    if (!value) return;
    const prev = out[out.length - 1];
    if (prev && prev.type === type) prev.value += value;
    else out.push({ type, value });
  };
  for (const m of code.matchAll(re)) {
    push('', code.slice(last, m.index));
    const [all, com, str, num, word, call, punct] = m;
    if (com) push('com', all);
    else if (str) push('str', all);
    else if (num) push('num', all);
    else if (word) push(words.has(lang === 'sql' ? word.toLowerCase() : word) ? 'kw' : call ? 'fn' : '', word);
    else if (punct) push('punct', all);
    else push('', all);
    last = m.index + all.length;
  }
  push('', code.slice(last));
  return out;
}
