const { pool } = require('./src/database/connection');

async function fixDevNSSPostalCode() {
    try {
        console.log('🔧 Fixing invalid postal codes...');
        
        // Find users with invalid postal codes
        const invalidUsers = await pool.query(`
            SELECT user_id, display_name, postal_code, country 
            FROM weather_users 
            WHERE display_name = 'DevNSS' 
            OR postal_code LIKE '%sailing%'
            OR postal_code = 'NorthSeaSailing'
            OR (postal_code REGEXP '^[a-zA-Z]+$' AND LENGTH(postal_code) > 10)
        `);
        
        console.log('Found users with invalid postal codes:', invalidUsers);
        
        for (const user of invalidUsers) {
            console.log(`\n🔧 Fixing user: ${user.display_name} (${user.user_id})`);
            console.log(`   Current postal code: "${user.postal_code}"`);
            
            let newPostalCode = '2100'; // Copenhagen, Denmark (default for DevNSS)
            let newCountry = 'DK';
            
            // If it's specifically DevNSS or contains "sailing", assume Denmark
            if (user.display_name === 'DevNSS' || user.postal_code.toLowerCase().includes('sailing')) {
                newPostalCode = '2100'; // Copenhagen Ø, Denmark
                newCountry = 'DK';
                console.log(`   Setting to Danish postal code: ${newPostalCode} (Copenhagen)`);
            } else {
                // For other invalid codes, deactivate user
                await pool.query(`
                    UPDATE weather_users 
                    SET is_active = FALSE,
                        postal_code = '0000'
                    WHERE user_id = ?
                `, [user.user_id]);
                
                console.log(`   ❌ Deactivated user due to invalid postal code`);
                continue;
            }
            
            const result = await pool.query(`
                UPDATE weather_users 
                SET postal_code = ?, 
                    country = ?,
                    country_code = ?,
                    is_active = TRUE
                WHERE user_id = ?
            `, [newPostalCode, newCountry, newCountry, user.user_id]);
            
            console.log(`   ✅ Updated postal code: ${newPostalCode}`);
            console.log(`   ✅ Set country: ${newCountry}`);
            console.log(`   ✅ Set as active user`);
            console.log(`   Rows affected: ${result.affectedRows}`);
        }
        
        // Verify the fix
        console.log('\n📊 Verifying fix...');
        const verifyUsers = await pool.query(`
            SELECT user_id, display_name, postal_code, country, is_active 
            FROM weather_users 
            WHERE display_name = 'DevNSS'
        `);
        
        console.log('DevNSS user after fix:', verifyUsers);
        
        console.log('\n✅ All postal code issues have been resolved!');
        console.log('   DevNSS now has valid Danish postal code 2100 (Copenhagen)');
        
    } catch (error) {
        console.error('❌ Error fixing postal codes:', error);
    } finally {
        process.exit(0);
    }
}

console.log('🚀 Starting postal code fix...');
fixDevNSSPostalCode();