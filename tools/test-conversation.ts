import { ConversationManagerService } from '../src/ai/conversation-manager.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const service = new ConversationManagerService();

  // Step 1: Initialize Event Creation in Serbian
  console.log('\n=============================================');
  console.log('STEP 1: Starting event creation flow in Serbian');
  console.log('=============================================');
  
  const transcript = 'kreirajte sastanak pod nazivom Godišnji sastanak za sutra u 10 sa Petrom i Milicom opis je planiranje projekta';
  console.log(`Transcript: "${transcript}"`);

  let res = await service.handle({
    token: 'fake-token',
    transcript: transcript,
    userId: 'user-1',
  });

  console.log('\n--- Text Response (Displayed on UI) ---');
  console.log(res.text);

  console.log('\n--- Internal Fields (To verify mapping) ---');
  console.log(JSON.stringify((service as any).fields, null, 2));
}

run().catch((err) => {
  console.error('Error running test:', err);
});
