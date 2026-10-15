// Slash commands typed in the composer. parseCommand() turns the text into a
// small plain object; the app does the rest (posting, the local clear, the
// nickname). Dice and coins are thrown on the sender's device and the result
// is posted as an ordinary message, so everyone sees the same numbers.

// Text faces, written with escapes so the source stays plain ASCII. The
// backslashes and underscores are escaped for the chat markdown.
const SHRUG = '¯\\\\\\_(ツ)\\_/¯';
const TABLEFLIP = '(╯°□°)╯︵ ┻━┻';
const UNFLIP = '┬─┬ノ( º \\_ ºノ)';

export const COMMANDS = [
  { name: 'me', args: 'text' },
  { name: 'roll', args: '2d6' },
  { name: 'coin', args: '' },
  { name: 'poll', args: 'question | option | option' },
  { name: 'shrug', args: 'text' },
  { name: 'tableflip', args: 'text' },
  { name: 'unflip', args: 'text' },
  { name: 'nick', args: 'name' },
  { name: 'clear', args: '' },
  { name: 'help', args: '' },
];

const MAX_DICE = 20;
const MAX_SIDES = 1000;

/** Commands that start with what was typed after the slash, for the suggestion list. */
export function suggestCommands(text) {
  const m = /^\/(\w*)$/.exec(text);
  return m ? COMMANDS.filter((c) => c.name.startsWith(m[1].toLowerCase())) : [];
}

/**
 * Parse a composer text. Returns null when it is not a command, otherwise one
 * of: { type: 'text', text, me }, { type: 'roll', count, sides, rolls, total },
 * { type: 'coin', heads }, { type: 'poll', poll }, { type: 'nick', name },
 * { type: 'clear' }, { type: 'help' } or { type: 'error', key, name }.
 */
export function parseCommand(input, random = Math.random) {
  const m = /^\/(\w+)(?:\s+([\s\S]*))?$/.exec(String(input || '').trim());
  if (!m) return null;
  const name = m[1].toLowerCase();
  const arg = (m[2] || '').trim();
  const pick = (n) => Math.floor(random() * n) + 1;
  const face = (f) => ({ type: 'text', text: arg ? `${arg} ${f}` : f, me: false });
  switch (name) {
    case 'me':
      return arg ? { type: 'text', text: arg, me: true } : { type: 'error', key: 'cmd.meUsage', name };
    case 'shrug':
      return face(SHRUG);
    case 'tableflip':
      return face(TABLEFLIP);
    case 'unflip':
      return face(UNFLIP);
    case 'roll': {
      const dice = /^(\d*)d(\d+)$/i.exec(arg || 'd6') || (/^\d+$/.test(arg) ? [arg, '1', arg] : null);
      const count = dice ? Number(dice[1] || 1) : 0;
      const sides = dice ? Number(dice[2]) : 0;
      if (!dice || count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) return { type: 'error', key: 'cmd.rollUsage', name };
      const rolls = Array.from({ length: count }, () => pick(sides));
      return { type: 'roll', count, sides, rolls, total: rolls.reduce((a, b) => a + b, 0) };
    }
    case 'coin':
    case 'flip':
      return { type: 'coin', heads: pick(2) === 1 };
    case 'poll': {
      const parts = arg.split('|').map((p) => p.trim());
      const [q, ...options] = parts;
      const opts = options.filter(Boolean);
      return q && opts.length >= 2 ? { type: 'poll', poll: { q, options: opts, multi: false } } : { type: 'error', key: 'cmd.pollUsage', name };
    }
    case 'nick': {
      const nick = arg.replace(/\s+/g, ' ').slice(0, 32);
      return nick ? { type: 'nick', name: nick } : { type: 'error', key: 'cmd.nickUsage', name };
    }
    case 'clear':
      return { type: 'clear' };
    case 'help':
      return { type: 'help' };
    default:
      return { type: 'error', key: 'cmd.unknown', name };
  }
}
