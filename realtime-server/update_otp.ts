import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    
    // The OTP code we want to set
    const plainOtp = '123456';
    
    // Hash it using SHA256 just like the Python backend does
    const hashedOtp = crypto.createHash('sha256').update(plainOtp).digest('hex');
    
    // Update the latest OTP for 'mohitkarn'
    const res = await client.query(`
        UPDATE otp_verifications 
        SET otp = $1 
        WHERE identifier = 'mohitkarn' 
        AND id = (SELECT id FROM otp_verifications WHERE identifier = 'mohitkarn' ORDER BY created_at DESC LIMIT 1)
        RETURNING *;
    `, [hashedOtp]);
    
    console.log("Updated OTP for mohitkarn to 123456. Rows affected:", res.rowCount);
    
    await client.end();
}

main().catch(console.error);
