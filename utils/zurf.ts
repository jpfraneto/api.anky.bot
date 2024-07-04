export function extractWordBeforeWaveEmoji(input: string): string {
    const regex = /(\S+)\s+🌊/;
    const match = input.match(regex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return "";
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