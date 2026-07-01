import { TranslationTable } from '../types';

/** Serbian (Latin) translations. Keys must match en.ts exactly. */
const sr: TranslationTable = {
  // ---- conversation messages (spoken to the user) ----
  'msg.cantHear': 'Izvinite, nisam razumeo. Možete li ponoviti?',
  'msg.noApiKey':
    'Asistent još nije u potpunosti podešen, pa ne mogu da obradim zahtev.',
  'msg.nluError': 'Imao sam problem da razumem. Možete li ponoviti?',
  'msg.cancelled':
    'U redu, otkazao sam unos ({noun}). Šta želite sledeće da uradite?',
  'msg.cancelledNone': 'U redu. Šta želite da uradite?',
  'msg.chooseIntent':
    'Mogu da vam pomognem da kreirate zadatak, belešku, događaj ili evidenciju rada. Šta želite?',
  'msg.ack': 'U redu. ',
  'msg.great': 'Odlično.',
  'msg.updated': 'Ažurirano.',
  'msg.summaryHeader': 'Evo podataka koje imam ({noun}):',
  'msg.confirmCreate':
    'Da li želite da kreiram ovaj unos ({noun}) ili biste prvo želeli da izmenite neko polje? Recite „kreiraj“ za potvrdu ili mi recite koje polje da izmenim.',
  'msg.created': 'Gotovo. Kreirano: {noun}.',
  'msg.createFailed':
    'Nisam mogao da kreiram {noun}: {error}. Želite li da pokušamo ponovo ili nešto promenimo?',
  'msg.invalidEnum':
    '{field} mora biti jedna od sledećih vrednosti: {values}. Izaberite jednu od njih.',
  'msg.notSet': 'Nije postavljeno',
  'msg.closing':
    'Nema na čemu! Prijatan dan. Samo recite kad god vam ponovo zatrebam.',

  // ---- intent nouns ----
  'noun.task': 'zadatak',
  'noun.tasks': 'zadataka',
  'noun.note': 'beleška',
  'noun.notes': 'beleški',
  'noun.event': 'događaj',
  'noun.events': 'događaja',
  'noun.worklog': 'evidencija rada',
  'noun.worklogs': 'evidencija rada',
  'noun.reminder': 'podsetnik',
  'noun.reminders': 'podsetnika',

  // ---- query / update workers ----
  'query.countHeader': 'Evo šta sam pronašao:',
  'query.countLine': '- {count} {entity}',
  'query.listHeader': 'Pronašao sam {count} {entity}:',
  'query.moreResults': 'Ima još {count}.',
  'query.noResults': 'Nisam pronašao nijedan zapis: {entity}.',
  'query.noneConfigured':
    'Endpointi za pretragu još nisu podešeni. I dalje mogu da kreiram zapise.',
  'query.notConfigured':
    'Pretraga za {entity} još nije povezana. Pošaljite endpoint kada bude dostupan.',
  'query.failed': 'Nisam mogao da preuzmem {entity}: {error}',
  'update.whichEntity': 'Šta želite da ažurirate?',
  'update.cancelled': 'U redu, otkazao sam ažuriranje.',
  'update.noMatches': 'Nisam pronašao odgovarajuće zapise: {entity}.',
  'update.multipleMatches': 'Pronašao sam više odgovarajućih zapisa: {entity}:',
  'update.selectPrompt': 'Koji zapis želite da ažuriram?',
  'update.selectionNotFound':
    'Nisam mogao da prepoznam izbor. Izaberite po broju ili nazivu.',
  'update.whatChange': 'Šta želite da promenite za {record}?',
  'update.summaryHeader': 'Ovo su promene za {record}:',
  'update.confirm': 'Da li želite da ažuriram ovaj zapis ({entity})?',
  'update.updated': 'Gotovo. Ažurirano: {entity}.',
  'update.notConfigured':
    'Ažuriranje za {entity} još nije povezano. Pošaljite endpoint kada bude dostupan.',
  'update.failed': 'Nisam mogao da ažuriram zapis: {error}',
  'update.nothingToConfirm': 'Trenutno nema ažuriranja za potvrdu.',
  'update.missingId': 'Pronašao sam zapis, ali nema ID koji mogu da ažuriram.',
  'delete.whichEntity': 'Šta želite da obrišete?',
  'delete.cancelled': 'U redu, otkazao sam zahtev za brisanje.',
  'delete.noMatches': 'Nisam pronašao odgovarajuće zapise: {entity}.',
  'delete.multipleMatches': 'Pronašao sam više odgovarajućih zapisa: {entity}:',
  'delete.selectPrompt': 'Koji zapis želite da obrišem?',
  'delete.selectionNotFound':
    'Nisam mogao da prepoznam izbor. Izaberite po broju ili nazivu.',
  'delete.confirm': 'Da li želite da obrišem {record}?',
  'delete.deleted': 'Gotovo. Obrisano: {entity}.',
  'delete.notConfigured':
    'Brisanje za {entity} još nije povezano. Pošaljite endpoint kada bude dostupan.',
  'delete.failed': 'Nisam mogao da obrišem zapis: {error}',
  'delete.nothingToConfirm': 'Trenutno nema zahteva za brisanje za potvrdu.',
  'delete.missingId': 'Pronašao sam zapis, ali nema ID koji mogu da obrišem.',
  'date.today': 'danas',
  'date.tomorrow': 'sutra',
  'date.todayAt': 'danas u {time}',
  'date.tomorrowAt': 'sutra u {time}',
  'date.dateAtTime': '{date} u {time}',
  'duration.minutes': '{count} minuta',
  'duration.hours': '{count} sati',
  'duration.hoursMinutes': '{hours} sati i {minutes} minuta',
  'speech.hiddenId': 'interni ID je sakriven',
  'enum.low': 'nizak',
  'enum.standard': 'standardan',
  'enum.high': 'visok',
  'enum.extreme': 'ekstreman',
  'enum.normal': 'normalno',
  'enum.urgent': 'hitno',
  'enum.todo': 'za uraditi',
  'enum.in_progress': 'u toku',
  'enum.done': 'završeno',
  'enum.cancelled': 'otkazano',
  'enum.idea': 'Ideja',
  'enum.reminder': 'Podsetnik',
  'enum.personal': 'Lično',
  'enum.meeting': 'Sastanak',
  'enum.kick-off': 'Početni sastanak',
  'enum.training': 'Obuka',
  'enum.workshop': 'Radionica',
  'enum.conference': 'Konferencija',
  'enum.presentation': 'Prezentacija',
  'enum.interview': 'Intervju',
  'enum.trip': 'Putovanje',

  // ---- HTTP / API errors ----
  'error.validation': 'Validacija nije uspela',
  'error.internal': 'Interna greška servera',

  // ---- task fields ----
  'field.task.title.label': 'Naziv',
  'field.task.title.question': 'Kako da nazovem zadatak?',
  'field.task.priority.label': 'Prioritet',
  'field.task.priority.question':
    'Koji prioritet — nizak, standardan, visok ili ekstreman?',
  'field.task.urgency.label': 'Hitnost',
  'field.task.urgency.question': 'Da li je normalno ili hitno?',
  'field.task.task_type.label': 'Tip zadatka',
  'field.task.task_type.question': 'Koji je tip zadatka?',
  'field.task.profile.label': 'Profil',
  'field.task.profile.question': 'Za koji profil je ovo?',
  'field.task.estimated_time.label': 'Procenjeno vreme',
  'field.task.estimated_time.question':
    'Koliko sati procenjujete da će trajati?',
  'field.task.assignee.label': 'Izvršilac',
  'field.task.assignee.question': 'Ko je zadužen za ovo?',
  'field.task.startDate.label': 'Datum početka',
  'field.task.startDate.question': 'Kada treba da počne?',
  'field.task.dueDate.label': 'Rok',
  'field.task.dueDate.question': 'Koji je rok?',
  'field.task.domain.label': 'Domen',
  'field.task.domain.question': 'Koji radni domen?',
  'field.task.project.label': 'Projekat',
  'field.task.project.question': 'Koji projekat?',
  'field.task.objective.label': 'Cilj',
  'field.task.objective.question': 'Koji je cilj?',
  'field.task.description.label': 'Opis',
  'field.task.description.question': 'Želite li da dodate opis?',

  // ---- note fields ----
  'field.note.title.label': 'Naziv',
  'field.note.title.question': 'Kako da naslovim belešku?',
  'field.note.content.label': 'Sadržaj',
  'field.note.content.question': 'Šta treba da piše u belešci?',
  'field.note.type.label': 'Tip',
  'field.note.type.question':
    'Da li je Ideja, Podsetnik ili Lična?',
  'field.note.tag.label': 'Oznake',
  'field.note.tag.question': 'Želite li da dodate oznake?',
  'field.note.created_at.label': 'Vreme kreiranja',
  'field.note.created_at.question': 'Kada je kreirana?',
  'field.note.created_by.label': 'Kreirao',
  'field.note.created_by.question': 'Ko je kreirao?',

  // ---- event fields ----
  'field.event.eventName.label': 'Tip događaja',
  'field.event.eventName.question':
    'Koji je tip događaja? Izaberite jednu od opcija: Sastanak, Kick-off, Obuka, Radionica, Konferencija, Prezentacija, Intervju ili Putovanje.',
  'field.event.title.label': 'Naziv',
  'field.event.title.question': 'Koji je naziv događaja?',
  'field.event.eventDate.label': 'Datum i vreme',
  'field.event.eventDate.question': 'Za kada je zakazan?',
  'field.event.duration.label': 'Trajanje (minuti)',
  'field.event.duration.question': 'Koliko će trajati, u minutima?',
  'field.event.participants.label': 'Učesnici',
  'field.event.participants.question': 'Koga treba pozvati?',
  'field.event.isPriority.label': 'Prioritet',
  'field.event.isPriority.question':
    'Da li događaj treba označiti kao prioritetan?',
  'field.event.location.label': 'Lokacija',
  'field.event.location.question': 'Gde se održava?',
  'field.event.reminders.label': 'Podsetnici',
  'field.event.reminders.question': 'Kada da vas podsetim?',
  'field.event.description.label': 'Opis',
  'field.event.description.question': 'Želite li da dodate opis?',

  // ---- worklog fields ----
  'field.worklog.What.label': 'Urađeno',
  'field.worklog.What.question': 'Na čemu ste radili?',
  'field.worklog.StartTime.label': 'Vreme početka',
  'field.worklog.StartTime.question': 'Kada ste počeli?',
  'field.worklog.EndTime.label': 'Vreme završetka',
  'field.worklog.EndTime.question': 'Kada ste završili?',
  'field.worklog.How.label': 'Kako',
  'field.worklog.How.question': 'Kako ste to uradili?',
  'field.worklog.TaskName.label': 'Zadatak',
  'field.worklog.TaskName.question': 'Na koji zadatak se odnosi?',
  'field.worklog.Comment.label': 'Komentar',
  'field.worklog.Comment.question': 'Imate li dodatne komentare?',
};

export default sr;
