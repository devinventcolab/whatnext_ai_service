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

  it('keeps Serbian eventName inputs as Serbian and displays them localized in the summary', async () => {
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
    // The internal field for eventName should have been mapped to "Sastanak"
    expect((service as any).fields.eventName).toBe('Sastanak');

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
    expect(res.text).toContain('Sastanak, Početni sastanak, Obuka, Radionica, Konferencija, Prezentacija, Intervju, Putovanje');
  });

  it('correctly maps event description aliases (like eventDescription, opis) to the internal description field', async () => {
    // Start event creation with "opis" field alias
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: 'event',
      entity: 'event',
      command: 'create',
      queryMode: 'list',
      query: {},
      fields: {
        eventName: 'Sastanak',
        title: 'Sastanak tima',
        eventDate: '2026-06-30T10:00:00',
        participants: ['Petar'],
        duration: 60,
        opis: 'Ovo je opis sastanka na srpskom',
      },
      language: 'sr',
    });

    const res = await service.handle({
      token: 'fake-token',
      transcript: 'Kreiraj sastanak sa opisom',
      userId: 'user-1',
    });

    // The internal field for description should be populated with the value of 'opis'
    expect((service as any).fields.description).toBe('Ovo je opis sastanka na srpskom');
    expect(res.text).toContain('Opis: Ovo je opis sastanka na srpskom');
  });
});

describe('ConversationManagerService - Event Update Flow', () => {
  let service: ConversationManagerService;

  beforeEach(() => {
    service = new ConversationManagerService();
  });

  it('correctly parses, confirms updates and returns updated tool results and natural confirmation', async () => {
    const { EntityService } = require('./entity-service');

    // Mock the listed matches to return an existing event
    const mockEvent = {
      entity: 'event',
      id: 'event-123',
      title: 'Stari Sastanak',
      date: '2026-06-30T10:00:00',
      raw: {
        id: 'event-123',
        title: 'Stari Sastanak',
        eventDate: '2026-06-30T10:00:00',
      },
    };

    jest.spyOn(EntityService.prototype, 'list').mockResolvedValue({
      ok: true,
      value: [mockEvent],
    });

    jest.spyOn(EntityService.prototype, 'update').mockResolvedValue({
      ok: true,
      value: {
        ...mockEvent.raw,
        title: 'Novi Sastanak',
      },
    });

    // 1. Initiate update
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: null,
      entity: 'event',
      command: 'update',
      queryMode: 'list',
      query: { text: 'Stari Sastanak' },
      fields: { title: 'Novi Sastanak' },
      language: 'en',
    });

    let res = await service.handle({
      token: 'fake-token',
      transcript: 'Change title of Stari Sastanak to Novi Sastanak',
      userId: 'user-1',
    });

    // It should confirm the change first
    expect(res.text).toContain('Here are the changes for Stari Sastanak');
    expect(res.text).toContain('Title: Novi Sastanak');
    expect(res.text).toContain('Should I update this event?');

    // 2. Confirm the update
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: null,
      entity: 'event',
      command: 'confirm',
      queryMode: 'list',
      query: {},
      fields: {},
      language: 'en',
    });

    res = await service.handle({
      token: 'fake-token',
      transcript: 'Yes, update it',
      userId: 'user-1',
    });

    // It should return the natural confirmation
    expect(res.text).toBe("Done! I've updated the event by changing the title to **Novi Sastanak**.");

    // It should return the tool result with the entire updated object
    expect(res.toolResults).toHaveLength(1);
    expect(res.toolResults[0].toolName).toBe('updateEvent');
    expect(res.toolResults[0].result).toEqual({
      id: 'event-123',
      title: 'Novi Sastanak',
      eventDate: '2026-06-30T10:00:00',
    });
  });
});

describe('ConversationManagerService - SpeechText on Field Update', () => {
  let service: ConversationManagerService;

  beforeEach(() => {
    service = new ConversationManagerService();
  });

  it('generates customized speechText containing only the updated fields and asks for confirmation', async () => {
    // 1. User starts a note creation flow and provides all required fields (title, content)
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: 'note',
      entity: 'note',
      command: 'create',
      queryMode: 'list',
      query: {},
      fields: { title: 'Initial Title', content: 'Some content' },
      language: 'en',
    });

    let res = await service.handle({
      token: 'fake-token',
      transcript: 'create note with title Initial Title and content Some content',
      userId: 'user-1',
    });

    // The text contains the summary
    expect(res.text).toContain('Title: Initial Title');
    expect(res.text).toContain('Content: Some content');
    expect(res.text).toContain('Should I create this note');
    // Initial summary doesn't set speechText (falls back to res.text)
    expect(res.speechText).toBeUndefined();

    // 2. User says "change title to Updated Title"
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: 'note',
      entity: 'note',
      command: 'modify',
      queryMode: 'list',
      query: {},
      fields: { title: 'Updated Title' },
      language: 'en',
    });

    res = await service.handle({
      token: 'fake-token',
      transcript: 'change title to Updated Title',
      userId: 'user-1',
    });

    // The UI text still contains the complete summary for visual display
    expect(res.text).toContain('Title: Updated Title');
    expect(res.text).toContain('Content: Some content');
    expect(res.text).toContain('Should I create this note');

    // The speechText is customized and only includes the updated field and the confirmation question
    expect(res.speechText).toBeDefined();
    expect(res.speechText).toContain('Updated.');
    expect(res.speechText).toContain('Title: Updated Title');
    expect(res.speechText).not.toContain('Content: Some content'); // Should not include other fields
    expect(res.speechText).toContain('Should I create this note');
  });

  it('defaults the created_by field to the logged-in user name if provided, otherwise falls back to userId', async () => {
    // Test case 1: userName is provided
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: 'note',
      entity: 'note',
      command: 'create',
      queryMode: 'list',
      query: {},
      fields: { title: 'Book List', content: 'Some books to read' },
      language: 'en',
    });

    await service.handle({
      token: 'fake-token',
      transcript: 'create a note title Book List and content Some books to read',
      userId: 'user-123',
      userName: 'Alice Smith',
    });

    expect((service as any).fields.created_by).toBe('Alice Smith');
    expect((service as any).fields.created_at).toBeDefined();
    expect((service as any).fields.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Test case 2: userName is not provided
    service = new ConversationManagerService();
    jest.spyOn(service as any, 'classify').mockResolvedValue({
      intent: 'note',
      entity: 'note',
      command: 'create',
      queryMode: 'list',
      query: {},
      fields: { title: 'Book List 2', content: 'More books to read' },
      language: 'en',
    });

    await service.handle({
      token: 'fake-token',
      transcript: 'create a note title Book List 2 and content More books to read',
      userId: 'user-456',
    });

    expect((service as any).fields.created_by).toBe('user-456');
    expect((service as any).fields.created_at).toBeDefined();
    expect((service as any).fields.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
