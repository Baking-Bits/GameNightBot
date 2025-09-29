const { pool } = require('./src/database');

async function checkTables() {
    try {
        console.log('=== Checking Available Tables ===');
        
        const [tables] = await pool.execute('SHOW TABLES');
        console.log('Available tables:');
        console.log('Tables result:', tables);
        if (Array.isArray(tables)) {
            tables.forEach(table => {
                const tableName = Object.values(table)[0];
                console.log(`- ${tableName}`);
            });
        }
        
        // Check if it's discord_users table
        const [userTables] = await pool.execute(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = 'GameNightDB' 
            AND TABLE_NAME LIKE '%user%'
        `);
        
        console.log('\nUser-related tables:');
        userTables.forEach(table => {
            console.log(`- ${table.TABLE_NAME}`);
        });
        
        // Check the structure of the user table
        if (userTables.length > 0) {
            const userTableName = userTables[0].TABLE_NAME;
            console.log(`\n=== Structure of ${userTableName} ===`);
            
            const [structure] = await pool.execute(`DESCRIBE ${userTableName}`);
            structure.forEach(col => {
                console.log(`${col.Field}: ${col.Type} ${col.Null} ${col.Key} ${col.Default || ''}`);
            });
            
            // Check for Stephen
            console.log(`\n=== Looking for Stephen in ${userTableName} ===`);
            const [stephenData] = await pool.execute(`
                SELECT * FROM ${userTableName} 
                WHERE display_name LIKE '%Stephen%' OR username LIKE '%Stephen%'
                LIMIT 5
            `);
            
            console.log('Stephen records:', stephenData);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkTables();