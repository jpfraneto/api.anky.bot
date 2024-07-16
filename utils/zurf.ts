export function extractWordBeforeWaveEmoji(bio: string | undefined): string {
  if (!bio) return "";
  const match = bio.match(/(\S+)\s*👋/);
  return match ? match[1] : "";
}

const testStrings = [
    "meditation 🌊 · learning how to write (both words and code) /anky",
    "focus 🌊 · staying in the moment",
    "coding 🌊 · building new projects",
    "No emoji here",
    "🌊 Emoji at the start",
    "Multiple words before 🌊 emoji"
];

testStrings.forEach(str => {
    const result = extractWordBeforeWaveEmoji(str);
    console.log(`Input: "${str}"`);
    console.log(`Result: ${result}`);
    console.log('---');
});