import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    
    // Query the latest OTP codes
    const res = await client.query('SELECT * FROM otp_verifications ORDER BY created_at DESC LIMIT 5;');
    
    console.log("Latest OTP Codes:");
    console.table(res.rows);
    
    await client.end();
}

main().catch(console.error);
