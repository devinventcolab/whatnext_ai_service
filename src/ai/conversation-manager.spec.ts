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

describe('ConversationManagerService - Serbian Enum Handling and Translation', () => {
  let service: ConversationManagerService;

  beforeEach(() => {
    service = new ConversationManagerService();
  });

  it('maps Serbian eventName inputs to English canonical enums and displays them localized in the summary', async () => {
    // 1. Start the event creation flow by providing "eventName" as "Sastanak"
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: 'event',
      entity: 'event',
      command: 'create',
      queryMode: 'list',
      query: {},
      fields: { eventName: 'Sastanak' },
      language: 'sr',
    });

    let res = await service.handle({
      token: 'fake-token',
      transcript: 'Kreiraj sastanak',
      userId: 'user-1',
    });

    // It should switch active language to Serbian
    expect(service.activeLanguage).toBe('sr');
    // The internal field for eventName should have been mapped to "Meeting"
    expect((service as any).fields.eventName).toBe('Meeting');

    // 2. Provide the remaining required fields for the event: title, eventDate, participants
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: 'event',
      entity: 'event',
      command: 'provide',
      queryMode: 'list',
      query: {},
      fields: {
        title: 'Godišnji sastanak',
        eventDate: '2026-06-30T10:00:00',
        participants: ['Petar', 'Milica'],
        duration: 60,
      },
      language: 'sr',
    });

    res = await service.handle({
      token: 'fake-token',
      transcript: 'Naziv je Godišnji sastanak, za sutra u 10, učesnici Petar i Milica',
      userId: 'user-1',
    });

    // Now all required fields are provided, so it should summarize and ask for confirmation
    // The summary should show the localized event type "Sastanak" instead of "Meeting"
    expect(res.text).toContain('Tip događaja: Sastanak');
    expect(res.text).toContain('Naziv: Godišnji sastanak');
    expect(res.text).toContain('Učesnici: Petar, Milica');
    expect(res.text).toContain('Da li želite da kreiram ovaj unos');
  });

  it('handles invalid Serbian enum values and displays localized options in the error message', async () => {
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: 'event',
      entity: 'event',
      command: 'create',
      queryMode: 'list',
      query: {},
      fields: { eventName: 'Nepostojeći' },
      language: 'sr',
    });

    const res = await service.handle({
      token: 'fake-token',
      transcript: 'Kreiraj nepostojeći',
      userId: 'user-1',
    });

    // It should display Serbian error message with localized event names
    expect(res.text).toContain('Tip događaja mora biti jedna od sledećih vrednosti');
    expect(res.text).toContain('Sastanak, Kick-off, Obuka, Radionica, Konferencija, Prezentacija, Intervju, Putovanje');
  });
});
