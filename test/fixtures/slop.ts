// Initialize the counter variable
let counter = 0;

// This function increments the counter
function increment() {
  // Increment counter by 1
  counter++;
}

// Handle the click event
function handleClick() {
  increment();
}

// Step 1: Validate the input
function processData(data: string) {
  // Step 2: Parse the data
  const parsed = JSON.parse(data);
  // Step 3: Transform the result
  return parsed;
}

// ============================================
// Helpers
// ============================================

function helper() {}

// --- Utils ---
function util() {}

// Wire format: 4-byte LE header followed by varint-encoded payload length
function parseHeader(buf: Buffer) {
  return buf.readUInt32LE(0);
}

// TODO: optimize this later
function slow() {}

try {
  JSON.parse("bad");
} catch (e) {}

try {
  JSON.parse("bad");
} catch (e) {
  console.log(e);
}
