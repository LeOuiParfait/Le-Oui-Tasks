import {
  Organization,
  User,
  Team,
  Project,
  Task,
  Objective,
  AttendanceRecord,
  Notification,
  AuditLog,
  DailyReport
} from '../types';

export const initialOrganization: Organization = {
  id: 'org-acme-1',
  name: 'Acme Digital Workspace',
  logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
  industry: 'Software & Cloud Services',
  timezone: 'Europe/Paris',
  workingHours: {
    monday:    { enabled: true,  start: '09:00', end: '18:00' },
    tuesday:   { enabled: true,  start: '09:00', end: '18:00' },
    wednesday: { enabled: true,  start: '09:00', end: '18:00' },
    thursday:  { enabled: true,  start: '09:00', end: '18:00' },
    friday:    { enabled: true,  start: '09:00', end: '17:00' },
    saturday:  { enabled: false, start: '09:00', end: '13:00' },
    sunday:    { enabled: false, start: '09:00', end: '17:00' }
  } as any,
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  defaultWorkdayDurationHours: 8,
  reportEmailRecipients: ['cto@acmedigital.com', 'nizarrallii85@gmail.com'],
  includeAdminsInReports: true
};

export const initialUsers: User[] = [
  {
    id: 'user-1',
    organizationId: 'org-acme-1',
    firstName: 'Nizar',
    lastName: 'Ali',
    email: 'nizarrallii85@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'super_admin',
    teamIds: ['team-dev', 'team-design'],
    jobTitle: 'VP of Product Engineering',
    presenceStatus: 'online',
    lastActiveAt: new Date().toISOString(),
    createdAt: '2025-01-10T08:00:00Z'
  },
  {
    id: 'user-2',
    organizationId: 'org-acme-1',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'sarah.j@acmedigital.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'admin',
    teamIds: ['team-dev'],
    jobTitle: 'Directrice des Opérations',
    presenceStatus: 'online',
    lastActiveAt: new Date().toISOString(),
    createdAt: '2025-01-12T08:00:00Z'
  },
  {
    id: 'user-3',
    organizationId: 'org-acme-1',
    firstName: 'Thomas',
    lastName: 'Vance',
    email: 'thomas.v@acmedigital.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'manager',
    teamIds: ['team-dev'],
    jobTitle: 'Chef de Projet Backend',
    presenceStatus: 'online',
    lastActiveAt: new Date().toISOString(),
    createdAt: '2025-01-15T08:00:00Z'
  },
  {
    id: 'user-4',
    organizationId: 'org-acme-1',
    firstName: 'Junel',
    lastName: 'Miller',
    email: 'junel.m@acmedigital.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'user',
    teamIds: ['team-dev'],
    jobTitle: 'Senior Full Stack Developer',
    presenceStatus: 'online',
    lastActiveAt: new Date().toISOString(),
    createdAt: '2025-02-01T08:00:00Z'
  },
  {
    id: 'user-5',
    organizationId: 'org-acme-1',
    firstName: 'Elena',
    lastName: 'Rostova',
    email: 'elena.r@acmedigital.com',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    role: 'team_lead',
    teamIds: ['team-design'],
    jobTitle: 'Lead Designer',
    presenceStatus: 'away',
    lastActiveAt: new Date(Date.now() - 15 * 60000).toISOString(),
    createdAt: '2025-02-05T08:00:00Z'
  },
  {
    id: 'user-6',
    organizationId: 'org-acme-1',
    firstName: 'Marcus',
    lastName: 'Chen',
    email: 'marcus.c@acmedigital.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    role: 'user',
    teamIds: ['team-comm'],
    jobTitle: 'DevOps Engineer',
    presenceStatus: 'online',
    lastActiveAt: new Date().toISOString(),
    createdAt: '2025-02-10T08:00:00Z'
  },
  {
    id: 'user-7',
    organizationId: 'org-acme-1',
    firstName: 'David',
    lastName: 'Kim',
    email: 'david.k@acmedigital.com',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    role: 'user',
    teamIds: ['team-dev'],
    jobTitle: 'QA Automation Engineer',
    presenceStatus: 'offline',
    lastActiveAt: new Date(Date.now() - 120 * 60000).toISOString(),
    createdAt: '2025-02-12T08:00:00Z'
  },
  {
    id: 'user-8',
    organizationId: 'org-acme-1',
    firstName: 'Amara',
    lastName: 'Okafor',
    email: 'amara.o@acmedigital.com',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80',
    role: 'user',
    teamIds: ['team-mktg'],
    jobTitle: 'Growth & Content Lead',
    presenceStatus: 'on_leave',
    lastActiveAt: new Date(Date.now() - 1440 * 60000).toISOString(),
    createdAt: '2025-02-15T08:00:00Z'
  }
];

export const initialTeams: Team[] = [
  {
    id: 'team-dev',
    organizationId: 'org-acme-1',
    name: 'Development',
    description: 'Core software engineering, backend APIs, and frontend experience.',
    icon: 'Code2',
    color: '#2563EB',
    managerId: 'user-2',
    memberIds: ['user-1', 'user-2', 'user-3', 'user-4', 'user-7'],
    createdAt: '2025-01-10T08:00:00Z'
  },
  {
    id: 'team-design',
    organizationId: 'org-acme-1',
    name: 'Design & UX',
    description: 'Design system, UI component library, and visual identity.',
    icon: 'Palette',
    color: '#7C3AED',
    managerId: 'user-1',
    memberIds: ['user-1', 'user-5'],
    createdAt: '2025-01-10T08:00:00Z'
  },
  {
    id: 'team-comm',
    organizationId: 'org-acme-1',
    name: 'DevOps & Infra',
    description: 'Cloud infrastructure, CI/CD pipelines, and security compliance.',
    icon: 'ShieldCheck',
    color: '#059669',
    managerId: 'user-3',
    memberIds: ['user-3', 'user-6'],
    createdAt: '2025-01-10T08:00:00Z'
  },
  {
    id: 'team-mktg',
    organizationId: 'org-acme-1',
    name: 'Marketing & Sales',
    description: 'Product marketing, documentation, and customer onboarding.',
    icon: 'TrendingUp',
    color: '#D97706',
    managerId: 'user-8',
    memberIds: ['user-8'],
    createdAt: '2025-01-10T08:00:00Z'
  }
];

export const initialProjects: Project[] = [
  {
    id: 'proj-midtrans',
    organizationId: 'org-acme-1',
    name: 'Midtrans Payment Integration',
    description: 'Sandbox configuration, charge endpoint integration, and webhook callback handler.',
    coverImage: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80',
    status: 'Active',
    health: 'on_track',
    priority: 'High',
    ownerId: 'user-2',
    teamIds: ['team-dev', 'team-comm'],
    members: [
      { userId: 'user-1', role: 'owner', addedAt: '2026-08-01T08:00:00Z' },
      { userId: 'user-2', role: 'lead', addedAt: '2026-08-01T08:00:00Z' },
      { userId: 'user-3', role: 'lead', addedAt: '2026-08-01T08:00:00Z' },
      { userId: 'user-4', role: 'contributor', addedAt: '2026-08-01T08:00:00Z' },
      { userId: 'user-6', role: 'viewer', addedAt: '2026-08-01T08:00:00Z' },
      { userId: 'user-7', role: 'contributor', addedAt: '2026-08-01T08:00:00Z' }
    ],
    memberIds: ['user-1', 'user-2', 'user-3', 'user-4', 'user-6', 'user-7'],
    ownerIds: ['user-1'],
    viewerIds: ['user-6'],
    startDate: '2026-08-01',
    dueDate: '2026-08-25',
    weightedProgress: 68,
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj-checkout',
    organizationId: 'org-acme-1',
    name: 'Checkout UI Redesign',
    description: 'Modernizing checkout flow, step-by-step payment UI, and mobile touch optimizations.',
    coverImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80',
    status: 'Active',
    health: 'at_risk',
    priority: 'Medium',
    ownerId: 'user-1',
    teamIds: ['team-design', 'team-dev'],
    members: [
      { userId: 'user-1', role: 'owner', addedAt: '2026-08-05T08:00:00Z' },
      { userId: 'user-5', role: 'lead', addedAt: '2026-08-05T08:00:00Z' },
      { userId: 'user-4', role: 'contributor', addedAt: '2026-08-05T08:00:00Z' }
    ],
    memberIds: ['user-1', 'user-5', 'user-4'],
    ownerIds: ['user-1'],
    viewerIds: [],
    startDate: '2026-08-05',
    dueDate: '2026-08-28',
    weightedProgress: 45,
    createdAt: '2026-08-05T08:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj-security',
    organizationId: 'org-acme-1',
    name: 'Platform Security Audit',
    description: 'OAuth 2.0 PKCE implementation, penetration test remediation, and rate limiting.',
    coverImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80',
    status: 'Active',
    health: 'on_track',
    priority: 'Critical',
    ownerId: 'user-3',
    teamIds: ['team-comm'],
    members: [
      { userId: 'user-3', role: 'owner', addedAt: '2026-08-08T08:00:00Z' },
      { userId: 'user-6', role: 'contributor', addedAt: '2026-08-08T08:00:00Z' }
    ],
    memberIds: ['user-3', 'user-6'],
    ownerIds: ['user-3'],
    viewerIds: [],
    startDate: '2026-08-08',
    dueDate: '2026-08-30',
    weightedProgress: 80,
    createdAt: '2026-08-08T08:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj-docs',
    organizationId: 'org-acme-1',
    name: 'API Documentation & Portal',
    description: 'Interactive OpenAPI specification, code samples in cURL/Node.js/Python, and developer docs.',
    coverImage: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80',
    status: 'Active',
    health: 'on_track',
    priority: 'Low',
    ownerId: 'user-8',
    teamIds: ['team-mktg'],
    members: [
      { userId: 'user-8', role: 'owner', addedAt: '2026-08-10T08:00:00Z' },
      { userId: 'user-4', role: 'contributor', addedAt: '2026-08-10T08:00:00Z' }
    ],
    memberIds: ['user-8', 'user-4'],
    ownerIds: ['user-8'],
    viewerIds: [],
    startDate: '2026-08-10',
    dueDate: '2026-09-05',
    weightedProgress: 100,
    createdAt: '2026-08-10T08:00:00Z',
    updatedAt: new Date().toISOString()
  }
];

export const initialTasks: Task[] = [
  // --- TODO COLUMN (Matches Screenshot: Setup Midtrans Sandbox, Payment Flow Design, etc) ---
  {
    id: 'task-1',
    organizationId: 'org-acme-1',
    projectId: 'proj-midtrans',
    teamId: 'team-dev',
    title: 'Setup Midtrans Sandbox',
    description: 'Configure server credentials, merchant key, and sandbox keys for payment gateway integration.',
    status: 'Todo',
    priority: 'Low',
    difficulty: 'Easy',
    assigneeIds: ['user-1'],
    creatorId: 'user-2',
    dueDate: '2026-08-16',
    startDate: '2026-08-11',
    estimatedHours: 4,
    weight: 2,
    subtasks: [
      { id: 'sub-1-1', title: 'Register Midtrans account', completed: false },
      { id: 'sub-1-2', title: 'Extract client & server key', completed: false },
      { id: 'sub-1-3', title: 'Set environment variables', completed: false },
      { id: 'sub-1-4', title: 'Verify sandbox connection', completed: false }
    ],
    labels: ['Payment', 'Setup'],
    attachments: [],
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },
  {
    id: 'task-2',
    organizationId: 'org-acme-1',
    projectId: 'proj-checkout',
    teamId: 'team-design',
    title: 'Payment Flow Design',
    description: 'Design responsive wireframes for credit card, QRIS, and virtual account selection UI.',
    status: 'Todo',
    priority: 'Medium',
    difficulty: 'Medium',
    assigneeIds: ['user-5'],
    creatorId: 'user-1',
    dueDate: '2026-08-18',
    startDate: '2026-08-12',
    estimatedHours: 12,
    weight: 3,
    subtasks: [
      { id: 'sub-2-1', title: 'Figma component library', completed: false },
      { id: 'sub-2-2', title: 'Mobile responsive views', completed: false },
      { id: 'sub-2-3', title: 'Dark mode palette option', completed: false },
      { id: 'sub-2-4', title: 'Interactive checkout prototype', completed: false }
    ],
    labels: ['Design', 'UI/UX'],
    attachments: [],
    createdAt: '2026-08-10T11:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },

  // --- INPROGRESS COLUMN (Matches Screenshot: API Integration (Charge), Database Payment Schema, Callback Handler) ---
  {
    id: 'task-3',
    organizationId: 'org-acme-1',
    projectId: 'proj-midtrans',
    teamId: 'team-dev',
    title: 'API Integration (Charge)',
    description: 'Implement core `/api/charge` endpoint to request payment token and trigger 3D Secure verification.',
    status: 'In Progress',
    priority: 'High',
    difficulty: 'Easy',
    assigneeIds: ['user-4', 'user-3'],
    creatorId: 'user-2',
    dueDate: '2026-08-15',
    startDate: '2026-08-09',
    estimatedHours: 8,
    actualHours: 4,
    weight: 5,
    subtasks: [
      { id: 'sub-3-1', title: 'Construct payload validator', completed: true },
      { id: 'sub-3-2', title: 'Invoke Midtrans SDK', completed: true },
      { id: 'sub-3-3', title: 'Store transaction token in DB', completed: false },
      { id: 'sub-3-4', title: 'Handle API timeout fallback', completed: false }
    ],
    labels: ['API', 'Backend'],
    attachments: [],
    createdAt: '2026-08-09T09:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },
  {
    id: 'task-4',
    organizationId: 'org-acme-1',
    projectId: 'proj-midtrans',
    teamId: 'team-dev',
    title: 'Database Payment Schema',
    description: 'Create PostgreSQL & Firestore transactions schema including status, gross_amount, payment_type, and order_id.',
    status: 'In Progress',
    priority: 'Medium',
    difficulty: 'Medium',
    assigneeIds: ['user-3'],
    creatorId: 'user-2',
    dueDate: '2026-08-14',
    startDate: '2026-08-08',
    estimatedHours: 6,
    actualHours: 3,
    weight: 4,
    subtasks: [
      { id: 'sub-4-1', title: 'Define Drizzle / Firestore schema', completed: true },
      { id: 'sub-4-2', title: 'Add indexes on order_id and status', completed: true },
      { id: 'sub-4-3', title: 'Write migration scripts', completed: false },
      { id: 'sub-4-4', title: 'Verify ACID transactions', completed: false }
    ],
    labels: ['Database', 'Backend'],
    attachments: [],
    createdAt: '2026-08-08T14:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },
  {
    id: 'task-5',
    organizationId: 'org-acme-1',
    projectId: 'proj-midtrans',
    teamId: 'team-dev',
    title: 'Callback Handler Endpoint',
    description: 'Build webhooks endpoint for asynchronous Midtrans notification callbacks (`settlement`, `pending`, `expire`).',
    status: 'In Progress',
    priority: 'High',
    difficulty: 'Medium',
    assigneeIds: ['user-4', 'user-1'],
    creatorId: 'user-3',
    dueDate: '2026-08-17',
    startDate: '2026-08-10',
    estimatedHours: 10,
    actualHours: 5,
    weight: 5,
    subtasks: [
      { id: 'sub-5-1', title: 'Verify signature_key hash', completed: true },
      { id: 'sub-5-2', title: 'Idempotency check', completed: true },
      { id: 'sub-5-3', title: 'Update order payment status', completed: false },
      { id: 'sub-5-4', title: 'Trigger email receipt dispatch', completed: false }
    ],
    labels: ['Webhooks', 'Security'],
    attachments: [],
    createdAt: '2026-08-10T15:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },
  {
    id: 'task-6',
    organizationId: 'org-acme-1',
    projectId: 'proj-midtrans',
    teamId: 'team-dev',
    title: 'QA Payment Scenarios',
    description: 'Test successful card charge, insufficient funds, expired QRIS, and network retry handling.',
    status: 'In Progress',
    priority: 'Low',
    difficulty: 'Easy',
    assigneeIds: ['user-7'],
    creatorId: 'user-2',
    dueDate: '2026-08-19',
    startDate: '2026-08-11',
    estimatedHours: 8,
    actualHours: 2,
    weight: 2,
    subtasks: [
      { id: 'sub-6-1', title: 'Write Playwright test suite', completed: true },
      { id: 'sub-6-2', title: 'Simulate network timeout', completed: false },
      { id: 'sub-6-3', title: 'Verify webhook retry mechanism', completed: false },
      { id: 'sub-6-4', title: 'Audit log assertion', completed: false }
    ],
    labels: ['QA', 'Testing'],
    attachments: [],
    createdAt: '2026-08-11T07:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },

  // --- REVIEW COLUMN (Matches Screenshot: Security Audit, UI Review - Checkout, Environment Config) ---
  {
    id: 'task-7',
    organizationId: 'org-acme-1',
    projectId: 'proj-security',
    teamId: 'team-comm',
    title: 'Security Audit',
    description: 'Review API key storage, TLS 1.3 configuration, and audit headers to prevent XSS and SSRF attacks.',
    status: 'In Review',
    priority: 'Critical',
    difficulty: 'Hard',
    assigneeIds: ['user-6'],
    creatorId: 'user-3',
    reviewerId: 'user-2',
    dueDate: '2026-08-14',
    startDate: '2026-08-07',
    estimatedHours: 16,
    actualHours: 14,
    weight: 8,
    subtasks: [
      { id: 'sub-7-1', title: 'Run OWASP ZAP scan', completed: true },
      { id: 'sub-7-2', title: 'Check CORS policy headers', completed: true },
      { id: 'sub-7-3', title: 'Verify rate limiter threshold', completed: true },
      { id: 'sub-7-4', title: 'Penetration test report', completed: false }
    ],
    labels: ['Security', 'Audit'],
    attachments: [],
    createdAt: '2026-08-07T11:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },
  {
    id: 'task-8',
    organizationId: 'org-acme-1',
    projectId: 'proj-checkout',
    teamId: 'team-design',
    title: 'UI Review - Checkout',
    description: 'Verify accessibility standards (WCAG AA), contrast ratios, keyboard navigation, and button click feedback.',
    status: 'In Review',
    priority: 'High',
    difficulty: 'Hard',
    assigneeIds: ['user-5'],
    creatorId: 'user-1',
    reviewerId: 'user-2',
    dueDate: '2026-08-15',
    startDate: '2026-08-08',
    estimatedHours: 10,
    actualHours: 9,
    weight: 5,
    subtasks: [
      { id: 'sub-8-1', title: 'Lighthouse accessibility 100%', completed: true },
      { id: 'sub-8-2', title: 'A11y screen reader support', completed: true },
      { id: 'sub-8-3', title: 'Focus outline visible state', completed: true },
      { id: 'sub-8-4', title: 'Cross-browser testing (Safari/Chrome/Firefox)', completed: false }
    ],
    labels: ['UI/UX', 'Review'],
    attachments: [],
    createdAt: '2026-08-08T16:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },
  {
    id: 'task-9',
    organizationId: 'org-acme-1',
    projectId: 'proj-midtrans',
    teamId: 'team-comm',
    title: 'Environment Config',
    description: 'Provision production secrets in Google Cloud Secret Manager & Vercel deployment variables.',
    status: 'In Review',
    priority: 'Critical',
    difficulty: 'Hard',
    assigneeIds: ['user-1', 'user-6'],
    creatorId: 'user-3',
    reviewerId: 'user-2',
    dueDate: '2026-08-16',
    startDate: '2026-08-09',
    estimatedHours: 6,
    actualHours: 5,
    weight: 6,
    subtasks: [
      { id: 'sub-9-1', title: 'GCP Secret Manager creation', completed: true },
      { id: 'sub-9-2', title: 'IAM role bindings', completed: true },
      { id: 'sub-9-3', title: 'Cloud Run env vars injection', completed: true },
      { id: 'sub-9-4', title: 'Deployment pipeline verification', completed: false }
    ],
    labels: ['DevOps', 'Config'],
    attachments: [],
    createdAt: '2026-08-09T12:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  },

  // --- COMPLETED COLUMN (Matches Screenshot: API Documentation, Logging & Monitoring) ---
  {
    id: 'task-10',
    organizationId: 'org-acme-1',
    projectId: 'proj-docs',
    teamId: 'team-mktg',
    title: 'API Documentation',
    description: 'Publish complete developer documentation for Midtrans API integration, error codes, and request examples.',
    status: 'Completed',
    priority: 'Low',
    difficulty: 'Easy',
    assigneeIds: ['user-8', 'user-4'],
    creatorId: 'user-2',
    reviewerId: 'user-2',
    dueDate: '2026-08-12',
    startDate: '2026-08-05',
    estimatedHours: 8,
    actualHours: 7,
    weight: 3,
    subtasks: [
      { id: 'sub-10-1', title: 'OpenAPI v3 specification', completed: true },
      { id: 'sub-10-2', title: 'Code snippets in 4 languages', completed: true },
      { id: 'sub-10-3', title: 'Interactive API sandbox console', completed: true },
      { id: 'sub-10-4', title: 'Error troubleshooting guide', completed: true }
    ],
    labels: ['Docs', 'Completed'],
    attachments: [],
    createdAt: '2026-08-05T10:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z',
    completedAt: '2026-08-10T16:00:00Z',
    validatedAt: '2026-08-10T17:00:00Z',
    validatedBy: 'user-2',
    validationComment: 'Documentation looks pristine and covers all edge cases!'
  },
  {
    id: 'task-11',
    organizationId: 'org-acme-1',
    projectId: 'proj-security',
    teamId: 'team-comm',
    title: 'Logging & Monitoring',
    description: 'Setup Datadog / Cloud Logging alerts for payment failures, 5xx server errors, and high latency endpoints.',
    status: 'Completed',
    priority: 'Critical',
    difficulty: 'Hard',
    assigneeIds: ['user-3', 'user-6'],
    creatorId: 'user-3',
    reviewerId: 'user-2',
    dueDate: '2026-08-11',
    startDate: '2026-08-04',
    estimatedHours: 12,
    actualHours: 11,
    weight: 8,
    subtasks: [
      { id: 'sub-11-1', title: 'Structured JSON logger setup', completed: true },
      { id: 'sub-11-2', title: 'Configure alert triggers (>2% 5xx rate)', completed: true },
      { id: 'sub-11-3', title: 'PagerDuty webhook integration', completed: true },
      { id: 'sub-11-4', title: 'Grafana latency dashboard', completed: true }
    ],
    labels: ['Monitoring', 'DevOps'],
    attachments: [],
    createdAt: '2026-08-04T09:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z',
    completedAt: '2026-08-10T14:00:00Z',
    validatedAt: '2026-08-10T15:00:00Z',
    validatedBy: 'user-2',
    validationComment: 'Alert channels tested successfully.'
  },

  // --- BLOCKED TASK (For demonstrating blocker management) ---
  {
    id: 'task-12',
    organizationId: 'org-acme-1',
    projectId: 'proj-midtrans',
    teamId: 'team-dev',
    title: 'Production Merchant Key Verification',
    description: 'Obtain production credentials from Midtrans account manager.',
    status: 'Blocked',
    priority: 'High',
    difficulty: 'Medium',
    assigneeIds: ['user-2'],
    creatorId: 'user-1',
    dueDate: '2026-08-13',
    startDate: '2026-08-08',
    estimatedHours: 4,
    weight: 5,
    subtasks: [
      { id: 'sub-12-1', title: 'Submit KYC business documents', completed: true },
      { id: 'sub-12-2', title: 'Await banking verification call', completed: false }
    ],
    blockerReason: 'Awaiting Midtrans compliance team business account approval.',
    labels: ['Blocked', 'External'],
    attachments: [],
    createdAt: '2026-08-08T08:00:00Z',
    updatedAt: '2026-08-11T08:00:00Z'
  }
];

export const initialObjectives: Objective[] = [
  {
    id: 'obj-1',
    organizationId: 'org-acme-1',
    title: 'Launch Midtrans Payment Gateway in Sandbox',
    description: 'Complete charge API, webhooks, and database logging with 100% test coverage before end of month.',
    level: 'organization',
    targetValue: 100,
    currentValue: 75,
    unit: '%',
    deadline: '2026-08-30',
    status: 'on_track',
    linkedTaskIds: ['task-1', 'task-3', 'task-4', 'task-5', 'task-6'],
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'obj-2',
    organizationId: 'org-acme-1',
    title: 'Maintain Zero Unhandled Security Vulnerabilities',
    description: 'Pass penetration tests, remediate top 10 OWASP risks, and enforce OAuth 2.0 PKCE everywhere.',
    level: 'team',
    teamId: 'team-comm',
    targetValue: 10,
    currentValue: 9,
    unit: 'audits',
    deadline: '2026-08-31',
    status: 'on_track',
    linkedTaskIds: ['task-7', 'task-9', 'task-11'],
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'obj-3',
    organizationId: 'org-acme-1',
    title: 'Achieve WCAG AA Accessibility Compliance on Checkout',
    description: 'Full screen-reader support, 100% keyboard accessibility, and mobile fluid design.',
    level: 'project',
    projectId: 'proj-checkout',
    targetValue: 100,
    currentValue: 85,
    unit: '%',
    deadline: '2026-08-28',
    status: 'on_track',
    linkedTaskIds: ['task-2', 'task-8'],
    createdAt: '2026-08-05T08:00:00Z'
  }
];

export const initialAttendanceRecords: AttendanceRecord[] = [
  {
    id: 'att-1',
    userId: 'user-1',
    organizationId: 'org-acme-1',
    date: '2026-08-11',
    startTime: '08:57',
    totalWorkMinutes: 280,
    totalBreakMinutes: 30,
    status: 'working',
    summary: 'Focused on platform architecture and Midtrans sandbox environment setup.'
  },
  {
    id: 'att-2',
    userId: 'user-2',
    organizationId: 'org-acme-1',
    date: '2026-08-11',
    startTime: '09:02',
    totalWorkMinutes: 275,
    totalBreakMinutes: 15,
    status: 'working',
    summary: 'Team standup and code review for payment schema.'
  },
  {
    id: 'att-3',
    userId: 'user-3',
    organizationId: 'org-acme-1',
    date: '2026-08-11',
    startTime: '08:45',
    totalWorkMinutes: 292,
    totalBreakMinutes: 45,
    status: 'working',
    summary: 'Backend callback handler and database schema migration.'
  },
  {
    id: 'att-4',
    userId: 'user-4',
    organizationId: 'org-acme-1',
    date: '2026-08-11',
    startTime: '09:15',
    totalWorkMinutes: 260,
    totalBreakMinutes: 20,
    status: 'working',
    summary: 'API charge endpoint development.'
  },
  {
    id: 'att-5',
    userId: 'user-6',
    organizationId: 'org-acme-1',
    date: '2026-08-11',
    startTime: '08:30',
    totalWorkMinutes: 305,
    totalBreakMinutes: 30,
    status: 'working',
    summary: 'Security audit and environment configuration.'
  }
];

export const initialNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-1',
    type: 'review_requested',
    title: 'Task Submitted for Review',
    message: 'Elena submitted "UI Review - Checkout" for manager validation.',
    link: '/tasks/task-8',
    read: false,
    createdAt: new Date(Date.now() - 25 * 60000).toISOString()
  },
  {
    id: 'notif-2',
    userId: 'user-1',
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: 'Sarah assigned you to "Setup Midtrans Sandbox".',
    link: '/tasks/task-1',
    read: false,
    createdAt: new Date(Date.now() - 120 * 60000).toISOString()
  },
  {
    id: 'notif-3',
    userId: 'user-1',
    type: 'report_ready',
    title: 'Daily Team Report Available',
    message: 'Development Team Daily Progress Report for Aug 10 generated.',
    link: '/reports',
    read: true,
    createdAt: new Date(Date.now() - 1440 * 60000).toISOString()
  }
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    organizationId: 'org-acme-1',
    actorId: 'user-2',
    actorName: 'Sarah Jenkins',
    action: 'Approved Task',
    targetType: 'task',
    targetId: 'task-10',
    targetTitle: 'API Documentation',
    details: 'Validated and marked completed with comment: "Documentation looks pristine and covers all edge cases!"',
    timestamp: '2026-08-10T17:00:00Z'
  },
  {
    id: 'audit-2',
    organizationId: 'org-acme-1',
    actorId: 'user-4',
    actorName: 'Junel Miller',
    action: 'Moved Task',
    targetType: 'task',
    targetId: 'task-3',
    targetTitle: 'API Integration (Charge)',
    details: 'Moved status from Todo to In Progress.',
    timestamp: '2026-08-10T14:30:00Z'
  },
  {
    id: 'audit-3',
    organizationId: 'org-acme-1',
    actorId: 'user-1',
    actorName: 'Nizar Ali',
    action: 'Started Workday',
    targetType: 'attendance',
    targetId: 'att-1',
    targetTitle: 'Attendance Clock-In',
    details: 'Clocked in at 08:57 from Paris office (Europe/Paris).',
    timestamp: '2026-08-11T08:57:00Z'
  }
];

export const initialReports: DailyReport[] = [
  {
    id: 'rep-1',
    organizationId: 'org-acme-1',
    teamId: 'team-dev',
    date: '2026-08-10',
    generatedBy: 'Sarah Jenkins',
    attendanceSummary: {
      expected: 5,
      present: 5,
      absent: 0
    },
    tasksSummary: {
      completed: 2,
      inProgress: 4,
      blocked: 1,
      inReview: 3,
      overdue: 0
    },
    blockers: [
      {
        taskTitle: 'Production Merchant Key Verification',
        assigneeName: 'Sarah Jenkins',
        reason: 'Awaiting Midtrans compliance team business account approval.'
      }
    ],
    projectProgress: [
      { projectName: 'Midtrans Payment Integration', progress: 68, health: 'on_track' },
      { projectName: 'Checkout UI Redesign', progress: 45, health: 'at_risk' },
      { projectName: 'Platform Security Audit', progress: 80, health: 'on_track' },
      { projectName: 'API Documentation & Portal', progress: 100, health: 'on_track' }
    ],
    prioritiesTomorrow: [
      'Finish Callback Handler Endpoint webhooks signature verification',
      'Resolve Midtrans merchant key compliance review',
      'Deploy Environment Config to GCP Secret Manager'
    ],
    sentAt: '2026-08-10T18:00:00Z',
    recipients: ['cto@acmedigital.com', 'nizarrallii85@gmail.com'],
    status: 'sent'
  }
];
