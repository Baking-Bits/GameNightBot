// Test UK postcode validation
const testCodes = [
    'SW1 1AA',    // Should work
    'SW1A 1AA',   // Should work
    'M1 1AA',     // Should work  
    'M60 1NW',    // Should work
    'CR0 2YR',    // Should work
    'DN55 1PT',   // Should work
    'W1A 0AX',    // Should work
    'EC1A 1BB',   // Should work
    'SW11AA',     // Should work (no space)
    '12345',      // US ZIP - should work
    'invalid',    // Should fail
];

// UK postcode regex from the updated code
const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;

console.log('Testing UK Postcode Validation:\n');

testCodes.forEach(code => {
    const isValidUK = ukPostcodeRegex.test(code);
    const isValidUS = /^\d{5}(-?\d{4})?$/.test(code.replace(/\s+/g, ''));
    
    console.log(`${code.padEnd(10)} -> UK: ${isValidUK ? '✅' : '❌'} | US: ${isValidUS ? '✅' : '❌'}`);
});

console.log('\n✅ SW1 1AA should now work correctly!');
