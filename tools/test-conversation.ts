import { ConversationManagerService } from '../src/ai/conversation-manager.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const service = new ConversationManagerService();

  // Step 1: Initialize Note Creation
  console.log('\n=============================================');
  console.log('STEP 1: Starting note creation flow');
  console.log('Input: "create a note with title initial test and content hello world"');
  console.log('=============================================');
  
  let res = await service.handle({
    token: 'fake-token',
    transcript: 'create a note with title initial test and content hello world',
    userId: 'user-1',
  });

  console.log('\n--- Text Response (Displayed on UI) ---');
  console.log(res.text);
  console.log('\n--- Speech Response (TTS Spoken) ---');
  console.log(res.speechText ?? '(Fallback to Text Response)');

  // Step 2: Modify Title
  console.log('\n=============================================');
  console.log('STEP 2: Modifying note title');
  console.log('Input: "change title to updated title"');
  console.log('=============================================');

  res = await service.handle({
    token: 'fake-token',
    transcript: 'change title to updated title',
    userId: 'user-1',
  });

  console.log('\n--- Text Response (Displayed on UI) ---');
  console.log(res.text);
  console.log('\n--- Speech Response (TTS Spoken) ---');
  console.log(res.speechText ?? '(Fallback to Text Response)');
}

run().catch((err) => {
  console.error('Error running test:', err);
});
