// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — we mock the drizzle `db` so the service can run in isolation.
//
// The service uses a fluent query builder pattern: `db.select().from().where()
// .orderBy().limit()` etc. We model that as a chainable mock where every
// terminal-ish method (`limit`, `orderBy`) returns a thenable resolved with
// a queue of pre-programmed result arrays.
// ---------------------------------------------------------------------------

const { dbState } = vi.hoisted(() => ({
  dbState: {
    selectResults: [] as any[],
    executeResults: [] as any[],
    insertResults: [] as any[],
    insertCalls: [] as any[],
    updateCalls: [] as any[],
    executeCalls: [] as any[],
  },
}));

function makeSelectChain() {
  // The final `.limit()` (or `.orderBy()`) must resolve with the next
  // pre-programmed result. Easiest: make every chainable both .then-able
  // and chainable.
  const chain: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        const next = dbState.selectResults.shift() ?? [];
        return (resolve: any) => resolve(next);
      }
      return () => chain;
    },
    apply() {
      return chain;
    },
  });
  return chain;
}

function makeUpdateChain(call: any) {
  const chain: any = {
    set: (data: any) => {
      call.set = data;
      return chain;
    },
    where: (_w: any) => {
      return Promise.resolve();
    },
  };
  return chain;
}

vi.mock('../../drizzle/db.js', () => {
  const dbObj = {
    select: () => makeSelectChain(),
    insert: (_table: any) => ({
      values: (data: any) => {
        dbState.insertCalls.push(data);
        const next = dbState.insertResults.shift() ?? { insertId: 1 };
        return Promise.resolve(next);
      },
    }),
    update: (_table: any) => {
      const call: any = {};
      dbState.updateCalls.push(call);
      return makeUpdateChain(call);
    },
    execute: (q: any) => {
      dbState.executeCalls.push(q);
      const next = dbState.executeResults.shift() ?? [[]];
      return Promise.resolve(next);
    },
  };
  return { db: dbObj };
});

vi.mock('../services/loggingService.js', () => ({
  default: { logSystemEvent: vi.fn(), logGameEvent: vi.fn() },
}));

// Import after mocks
import service, { FOREVER_DATE, DEFAULT_PROFANITY_WORDS } from '../services/chatModerationService.js';

beforeEach(() => {
  dbState.selectResults = [];
  dbState.executeResults = [];
  dbState.insertResults = [];
  dbState.insertCalls = [];
  dbState.updateCalls = [];
  dbState.executeCalls = [];
  service._resetCache();
});

describe('chatModerationService.isMuted', () => {
  it('returns muted=false when no rows exist', async () => {
    dbState.selectResults = [[]];
    const res = await service.isMuted(7);
    expect(res).toEqual({ muted: false });
  });

  it('returns muted=true with until/reason when an active row exists', async () => {
    const until = new Date(Date.now() + 60_000);
    dbState.selectResults = [[{ mutedUntil: until, reason: 'spam' }]];
    const res = await service.isMuted(7);
    expect(res.muted).toBe(true);
    expect(res.until).toEqual(until);
    expect(res.reason).toBe('spam');
  });

  it('treats DB errors as fail-open (muted=false)', async () => {
    // selectResults empty AND we throw — easier: throw on the very next .limit()
    // by making the chain reject. Use a one-shot override.
    const orig = (service as any);
    // Simulate error: empty result with a throw is tricky; reuse mock by
    // mutating the dbState to no results — service catches in try.
    dbState.selectResults = [
      new Proxy([], {
        get(target, prop) {
          if (prop === 'length') throw new Error('boom');
          return (target as any)[prop];
        },
      }) as any,
    ];
    const res = await service.isMuted(99);
    expect(res.muted).toBe(false);
  });
});

describe('chatModerationService.muteUser', () => {
  it('inserts a row with the computed mutedUntil and fetches it back', async () => {
    const insertedRow = {
      id: 11,
      userId: 5,
      mutedUntil: new Date(Date.now() + 60_000),
      mutedBy: 1,
      reason: 'spam',
      createdAt: new Date(),
    };
    dbState.insertResults = [{ insertId: 11 }];
    dbState.selectResults = [[insertedRow]];

    const res = await service.muteUser(5, 60_000, 1, 'spam');
    expect(res.id).toBe(11);
    expect(dbState.insertCalls).toHaveLength(1);
    expect(dbState.insertCalls[0].userId).toBe(5);
    expect(dbState.insertCalls[0].mutedUntil).toBeInstanceOf(Date);
    expect(dbState.insertCalls[0].mutedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('uses FOREVER_DATE when durationMs is -1', async () => {
    dbState.insertResults = [{ insertId: 0 }]; // no row to refetch
    dbState.selectResults = [[]];

    const res = await service.muteUser(5, -1, 1, null);
    expect(dbState.insertCalls[0].mutedUntil).toEqual(FOREVER_DATE);
    expect(res.mutedUntil).toEqual(FOREVER_DATE);
  });
});

describe('chatModerationService.unmuteUser', () => {
  it('updates muted_until to now', async () => {
    await service.unmuteUser(5);
    expect(dbState.updateCalls).toHaveLength(1);
    expect(dbState.updateCalls[0].set.mutedUntil).toBeInstanceOf(Date);
  });
});

describe('chatModerationService.softDeleteMessage', () => {
  it('issues a single UPDATE with the message id', async () => {
    dbState.executeResults = [[{}]];
    await service.softDeleteMessage(42, 1, 'rude');
    expect(dbState.executeCalls).toHaveLength(1);
  });

  it('is safe to call repeatedly (idempotent)', async () => {
    dbState.executeResults = [[{}], [{}]];
    await service.softDeleteMessage(42, 1, 'rude');
    await service.softDeleteMessage(42, 1, 'rude');
    expect(dbState.executeCalls.length).toBe(2);
  });
});

describe('chatModerationService.getProfanityWords', () => {
  it('returns defaults when settings.profanity_words is empty', async () => {
    dbState.selectResults = [[]];
    const words = await service.getProfanityWords();
    expect(words).toEqual(DEFAULT_PROFANITY_WORDS);
  });

  it('returns words from the setting when populated', async () => {
    dbState.selectResults = [[{ value: ['foo', 'bar'] }]];
    const words = await service.getProfanityWords();
    expect(words).toEqual(['foo', 'bar']);
  });

  it('parses JSON-string values', async () => {
    dbState.selectResults = [[{ value: '["baz"]' }]];
    const words = await service.getProfanityWords();
    expect(words).toEqual(['baz']);
  });

  it('caches results across calls', async () => {
    dbState.selectResults = [[{ value: ['cached'] }]];
    const a = await service.getProfanityWords();
    // Second call should hit the cache; no further selectResults consumed.
    const b = await service.getProfanityWords();
    expect(a).toEqual(b);
  });
});

describe('chatModerationService.applyProfanityFilter', () => {
  it('replaces matched words with same-length asterisks (case-insensitive)', () => {
    const out = service.applyProfanityFilter('You ASShole and shit', ['asshole', 'shit']);
    expect(out).toBe('You ******* and ****');
  });

  it('leaves content unchanged when wordlist is empty', () => {
    const out = service.applyProfanityFilter('clean text', []);
    expect(out).toBe('clean text');
  });

  it('returns content unchanged when content is empty/null', () => {
    expect(service.applyProfanityFilter('', ['foo'])).toBe('');
    expect(service.applyProfanityFilter(null as any, ['foo'])).toBeNull();
  });

  it('escapes regex metacharacters in profanity entries (no crash)', () => {
    // Punctuation in the wordlist must NOT cause a regex compile error.
    // Word boundaries prevent matching here, but the escape path is still exercised.
    const out = service.applyProfanityFilter('hello world', ['*.+?']);
    expect(out).toBe('hello world');
  });

  it('returns content when escaped words list is empty (after filtering)', () => {
    // All entries are filtered out as empty strings.
    const out = service.applyProfanityFilter('some text', ['', null as any]);
    expect(out).toBe('some text');
  });
});

describe('chatModerationService.getRecentMessages / getRecentMessagesForAdmin', () => {
  it('getRecentMessages issues a select chain and returns rows', async () => {
    const rows = [{ id: 1, content: 'hi' }];
    dbState.selectResults = [rows];
    const out = await service.getRecentMessages(10);
    expect(out).toEqual(rows);
  });

  it('getRecentMessagesForAdmin returns deleted+live rows by default', async () => {
    const rows = [{ id: 2, content: 'bad', deletedAt: new Date() }];
    dbState.selectResults = [rows];
    const out = await service.getRecentMessagesForAdmin(10, true);
    expect(out).toEqual(rows);
  });

  it('getRecentMessagesForAdmin excludes deleted when includeDeleted=false', async () => {
    const rows = [{ id: 3, content: 'live' }];
    dbState.selectResults = [rows];
    const out = await service.getRecentMessagesForAdmin(5, false);
    expect(out).toEqual(rows);
  });
});

describe('chatModerationService.getActiveMutes', () => {
  it('returns the active-mutes select result', async () => {
    const rows = [{ id: 1, userId: 5, username: 'u', mutedUntil: new Date() }];
    dbState.selectResults = [rows];
    const out = await service.getActiveMutes();
    expect(out).toEqual(rows);
  });
});

describe('chatModerationService.getProfanityWords - additional branches', () => {
  it('falls back to defaults when stored value is not an array', async () => {
    dbState.selectResults = [[{ value: 42 }]];
    const words = await service.getProfanityWords();
    expect(words).toEqual(DEFAULT_PROFANITY_WORDS);
  });

  it('falls back to defaults when stored JSON parses to a non-array', async () => {
    dbState.selectResults = [[{ value: '{"not":"array"}' }]];
    const words = await service.getProfanityWords();
    expect(words).toEqual(DEFAULT_PROFANITY_WORDS);
  });

  it('falls back to defaults when stored JSON is malformed', async () => {
    dbState.selectResults = [[{ value: '{not-json' }]];
    const words = await service.getProfanityWords();
    expect(words).toEqual(DEFAULT_PROFANITY_WORDS);
  });

  it('falls back to defaults when the stored array is empty after filtering', async () => {
    // Array of length-0 strings: filter leaves words empty -> service uses defaults.
    dbState.selectResults = [[{ value: ['', ''] }]];
    const words = await service.getProfanityWords();
    expect(words).toEqual(DEFAULT_PROFANITY_WORDS);
  });

  it('falls back to defaults when read throws (catch branch)', async () => {
    // Make the select chain throw on row index access so the outer try/catch fires.
    dbState.selectResults = [
      new Proxy([], {
        get(target, prop) {
          if (prop === '0') throw new Error('boom');
          if (prop === 'then') return undefined;
          return (target as any)[prop];
        },
      }) as any,
    ];
    const words = await service.getProfanityWords();
    expect(words).toEqual(DEFAULT_PROFANITY_WORDS);
  });
});

describe('chatModerationService.setProfanityWords', () => {
  it('persists a trimmed/lowercased word list and invalidates the cache', async () => {
    // Prime the cache first.
    dbState.selectResults = [[{ value: ['cached'] }]];
    await service.getProfanityWords();
    expect((service as any)._profanityCache).not.toBeNull();

    dbState.executeResults = [[{}]];
    await service.setProfanityWords(['  Fuck  ', 'SHIT', '', null as any], 99);
    expect((service as any)._profanityCache).toBeNull();
    // Inspect the SQL args: the JSON.stringified array of cleaned words appears
    // among the tagged-sql params.
    const args = dbState.executeCalls[0];
    const flat = JSON.stringify(args);
    expect(flat).toContain('fuck');
    expect(flat).toContain('shit');
  });

  it('persists an empty list when input is not an array', async () => {
    dbState.executeResults = [[{}]];
    await service.setProfanityWords(null as any, null);
    const flat = JSON.stringify(dbState.executeCalls[0]);
    expect(flat).toContain('[]');
  });
});
