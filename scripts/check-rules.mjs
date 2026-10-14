// House rules for every tracked or new text file: no emoji, no en or em dash
// characters, no names of other CSS frameworks and no mention of who or what
// wrote the code. Test data that needs those characters uses escapes.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const binary = /\.(png|jpe?g|gif|ico|webp|avif|pdf|ttf|otf|woff2?|wasm|mp3|ogg|webm|mp4|y4m|wav)$/i;
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !binary.test(f) && f !== 'package-lock.json');

const word = (...parts) => parts.join('');
const rules = [
  [new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`), 'an en or em dash'],
  [/\p{Extended_Pictographic}/u, 'an emoji'],
  [new RegExp(`${word('tail', 'wind')}|${word('boot', 'strap')}|\\b${word('bul', 'ma')}\\b|${word('found', 'ation')}\\.css`, 'i'), 'the name of another CSS framework'],
  [new RegExp(`\\b(${word('Clau', 'de')}|${word('Anthro', 'pic')}|${word('Chat', 'GPT')}|${word('Co', 'pilot')}|${word('Open', 'A', 'I')})\\b`, 'i'), 'a mention of an assistant'],
  [new RegExp(`\\b${word('A', 'I')}\\b`), 'a mention of generated code'],
];

const problems = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of rules) if (re.test(line)) problems.push(`${file}:${i + 1}: contains ${what}`);
  });
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`house rules: ${files.length} files clean`);
