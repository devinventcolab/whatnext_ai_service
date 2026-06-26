import { ConversationManagerService } from './conversation-manager.service';

jest.mock('../config/env', () => {
  const actual = jest.requireActual('../config/env');
  return {
    ...actual,
    env: {
      ...actual.env,
      OPENAI_API_KEY: 'fake-key',
    },
  };
});

describe('ConversationManagerService - Serbian Greetings', () => {
  let service: ConversationManagerService;

  beforeEach(() => {
    service = new ConversationManagerService();
  });

  it('handles Serbian greetings without changing the session language', async () => {
    // Assert starting language is English (default)
    expect(service.activeLanguage).toBe('en');

    // Send "Zdravo" greeting
    const res1 = await service.handle({
      token: 'fake-token',
      transcript: 'Zdravo',
      userId: 'user-1',
    });

    // The response text should be in Serbian and contain the greeting
    expect(res1.text).toContain('Zdravo!');
    expect(res1.text).toContain('Mogu da vam pomognem da kreirate zadatak');
    // The assistant result language should be 'sr' (for TTS)
    expect(res1.language).toBe('sr');
    // BUT the service's active language (session state) must remain 'en'
    expect(service.activeLanguage).toBe('en');
  });

  it('handles Serbian multi-greeting combinations like "Zdravo, Ćao"', async () => {
    const res = await service.handle({
      token: 'fake-token',
      transcript: 'Zdravo, Ćao!',
      userId: 'user-1',
    });

    expect(res.text).toContain('Zdravo, Ćao!');
    expect(res.language).toBe('sr');
    expect(service.activeLanguage).toBe('en');
  });

  it('handles "Ćao", "Cao", and "Ciao" and preserves English session language', async () => {
    for (const greeting of ['Ćao', 'Cao', 'Ciao']) {
      const res = await service.handle({
        token: 'fake-token',
        transcript: greeting,
        userId: 'user-1',
      });

      expect(res.text).toContain(`${greeting}!`);
      expect(res.language).toBe('sr');
      expect(service.activeLanguage).toBe('en');
    }
  });
});

describe('ConversationManagerService - Exit/Close Commands', () => {
  let service: ConversationManagerService;

  beforeEach(() => {
    service = new ConversationManagerService();
  });

  const expectedEnglishFarewells = [
    'Thank you! Have a great day. See you again soon!',
    'Thanks for using the app. Take care, and see you again!',
    'Alright! Thanks for stopping by. See you next time!',
  ];

  const expectedSerbianFarewells = [
    'Hvala vam! Prijatan dan. Vidimo se uskoro!',
    'Hvala što koristite aplikaciju. Čuvajte se i vidimo se ponovo!',
    'U redu! Hvala što ste svratili. Vidimo se sledeći put!',
  ];

  it('handles "Close the app" and returns command: "close" and a random English farewell message', async () => {
    const res = await service.handle({
      token: 'fake-token',
      transcript: 'Close the app',
      userId: 'user-1',
    });

    expect(res.command).toBe('close');
    expect(expectedEnglishFarewells).toContain(res.text);
    expect(res.language).toBe('en');
  });

  it('handles "Leave the app" and returns command: "close" and a random English farewell message', async () => {
    const res = await service.handle({
      token: 'fake-token',
      transcript: 'Leave the app',
      userId: 'user-1',
    });

    expect(res.command).toBe('close');
    expect(expectedEnglishFarewells).toContain(res.text);
    expect(res.language).toBe('en');
  });

  it('handles Serbian "zatvori aplikaciju" and returns command: "close" and a random Serbian farewell message', async () => {
    const res = await service.handle({
      token: 'fake-token',
      transcript: 'zatvori aplikaciju',
      userId: 'user-1',
    });

    expect(res.command).toBe('close');
    expect(expectedSerbianFarewells).toContain(res.text);
    expect(res.language).toBe('sr');
  });
});
