import '@testing-library/jest-dom/vitest';

// Mock Next.js server internals
vi.mock('next/cache', () => ({
  __esModule: true,
  default: {
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    revalidate: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
    has: vi.fn(() => false),
  })),
}));

// Mock the database - API routes use Prisma models that may not exist in test DB
vi.mock('@/lib/db', () => ({
  db: {
    // Alert routes
    wiFiAlert: { findMany: vi.fn(() => []), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(() => ({ _count: 0 })), groupBy: vi.fn(() => []), },
    // Device routes
    wiFiDevice: { findMany: vi.fn(() => []), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(() => ({ _count: 0 })), findUnique: vi.fn() },
    // Identity log routes
    wiFiIdentityLog: { findMany: vi.fn(() => []), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(() => ({ _count: 0 })), groupBy: vi.fn(() => []), aggregate: vi.fn() },
    // Consent log routes
    wiFiConsentLog: { findMany: vi.fn(() => []), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(() => ({ _count: 0 })), groupBy: vi.fn(() => [])) },
    // Pre-arrival routes
    wiFiPreArrivalConfig: { findMany: vi.fn(() => []), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(() => ({ _count: 0 })), findUnique: vi.fn() },
    wiFiPreArrivalLog: { findMany: vi.fn(() => []), count: vi.fn(() => ({ _count: 0 })), groupBy: vi.fn(() => []) },
    // Bandwidth upgrade routes
    wiFiUpgrade: { findMany: vi.fn(() => []), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(() => ({ _count: 0 })), groupBy: vi.fn(() => [])), aggregate: vi.fn() },
    // Satisfaction routes
    wiFiSatisfactionSurvey: { findMany: vi.fn(() => []), create: vi.fn(), count: vi.fn(() => ({ _count: 0 })), groupBy: vi.fn(() => [])), aggregate: vi.fn() },
    // SLA routes
    wiFiSLAConfig: { findMany: vi.fn(() => []), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(() => ({ _count: 0 })), findUnique: vi.fn() },
    wiFiSLAMetric: { findMany: vi.fn(() => []), findFirst: vi.fn(), create: vi.fn(), count: vi.fn(() => ({ _count: 0 })), groupBy: vi.fn(() => [])), aggregate: vi.fn(), deleteMany: vi.fn() },
    // Revenue dashboard
    $queryRaw: vi.fn(() => []),
    $queryRawUnsafe: vi.fn(() => []),
    // Generic query
    wiFiPlan: { findMany: vi.fn(() => []), findFirst: vi.fn() },
    // For delivery logs
    deliveryLog: { findMany: vi.fn(() => []) },
  },
}));

// Suppress console.error during tests
vi.spyOn(console, 'error').mockImplementation(() => {});
