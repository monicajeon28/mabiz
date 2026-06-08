const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY!;
const c3 = raw.replace(/^["']|["']$/g, '').replace(/\\"/g, '"');

// position 161 주변 (char code 단위)
console.log('c3 position 150~185:');
for (let i = 150; i < 185 && i < c3.length; i++) {
  const ch = c3[i];
  const code = c3.charCodeAt(i);
  const printable = code === 10 ? '\\n(개행)' : code === 13 ? '\\r' : code === 9 ? '\\t' : ch;
  console.log(`  [${i}] code=${code} char=${printable}`);
}
