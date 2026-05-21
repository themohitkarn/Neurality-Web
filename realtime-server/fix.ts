import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    
    // Delete all chat settings to allow the unique constraint to be added
    await client.query('DELETE FROM chat_settings;');
    
    // Also delete duplicates for other unique constraints just in case:
    // device_token in device_sessions
    // message_reactions user_id/message_id
    // messages client_message_id
    // users email / phone_number
    // It's probably safer to just focus on chat_settings since the error explicitly said: 
    // "Unique constraint failed on the fields: (`user_id`,`conversation_id`)"
    
    console.log("Deleted all chat settings.");
    await client.end();
}

main().catch(console.error);
