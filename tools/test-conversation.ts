import { ConversationManagerService } from '../src/ai/conversation-manager.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const service = new ConversationManagerService();

  // Step 1: Initialize Note Creation with Long Content
  console.log('\n=============================================');
  console.log('STEP 1: Starting note creation flow with long content');
  console.log('=============================================');
  
  let res = await service.handle({
    token: 'fake-token',
    transcript: 'create a note with title reading books and content Reading books is one of the best habits a person can develop. Books help us gain knowledge, improve our imagination, and learn new ideas. They allow us to explore different places, cultures, and experiences without leaving our homes. Whether we read storybooks, history books, science books, or biographies, every book teaches us something valuable.Reading also improves our vocabulary and communication skills. When we read regularly, we learn new words and understand how to use them correctly. This helps us write better and speak more confidently. Students who read often usually perform better in school because they can understand lessons more easily and express their thoughts clearly.Another benefit of reading is that it improves concentration and memory. When we read a book, we focus on the story or information, which helps train our minds to pay attention for longer periods. Reading also reduces stress because it allows us to relax and forget our worries for some time. Many people enjoy reading before going to bed because it helps them feel calm and peaceful.Books can also inspire us to become better people. We learn about successful individuals, their struggles, and how they achieved their goals. Their stories motivate us to work hard, stay positive, and never give up. Fiction books teach us about friendship, kindness, honesty, and courage, while non-fiction books help us understand the real world.In today\'s digital world, many people spend hours on social media and entertainment. Although technology has many advantages, reading books remains an important activity because it develops our thinking and creativity. Even reading for just twenty or thirty minutes every day can make a big difference over time.',
    userId: 'user-1',
  });

  console.log('\n--- Text Response (Displayed on UI) ---');
  console.log(res.text);
}

run().catch((err) => {
  console.error('Error running test:', err);
});
