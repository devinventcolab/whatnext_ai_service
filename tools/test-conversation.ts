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
  console.log('Input: "create task with title what next and assignee Raj and due date tomorrow"');
  console.log('=============================================');

  let res = await service.handle({
    token: 'fake-token',
    transcript: 'create task with title what next and assignee Raj and due date tomorrow',
    userId: 'user-1',
  });

  console.log('\n--- Text Response (Displayed on UI) ---');
  console.log(res.text);
  console.log('\n--- Speech Response (TTS Spoken) ---');
  console.log(res.speechText ?? '(Fallback to Text Response)');

  // Step 2: Modify Title
  console.log('\n=============================================');
  console.log('STEP 2: Modifying note title');
  console.log('Input: "change priority to high"');
  console.log('=============================================');

  res = await service.handle({
    token: 'fake-token',
    transcript: 'change priority to high',
    userId: 'user-1',
  });

  console.log('\n--- Text Response (Displayed on UI) ---');
  console.log(res.text);
  console.log('\n--- Speech Response (TTS Spoken) ---');
  console.log(res ?? '(Fallback to Text Response)');
}

run().catch((err) => {
  console.error('Error running test:', err);
});
