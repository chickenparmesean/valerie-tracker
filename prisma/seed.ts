import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding test data for WorkSpace testing...');

  // 1. Upsert test VA user
  const user = await prisma.user.upsert({
    where: { id: 'user_va_001' },
    update: {
      name: 'Test VA',
      email: 'testva@hirevalerie.com',
      trackerApiKey: 'vt_test123',
    },
    create: {
      id: 'user_va_001',
      name: 'Test VA',
      email: 'testva@hirevalerie.com',
      supabaseId: 'supabase_test_va_001',
      trackerApiKey: 'vt_test123',
    },
  });
  console.log(`  User: ${user.id} (${user.email})`);

  // 2. Upsert organization
  const org = await prisma.organization.upsert({
    where: { id: 'org_test_001' },
    update: {
      name: 'Test Organization',
      timezone: 'America/New_York',
      screenshotFreq: 1,
      idleTimeoutMin: 5,
      trackApps: true,
      trackUrls: true,
      blurScreenshots: false,
    },
    create: {
      id: 'org_test_001',
      name: 'Test Organization',
      timezone: 'America/New_York',
      screenshotFreq: 1,
      idleTimeoutMin: 5,
      trackApps: true,
      trackUrls: true,
      blurScreenshots: false,
    },
  });
  console.log(`  Organization: ${org.id} (${org.name})`);

  // 3. Upsert membership (VA in org)
  const membership = await prisma.membership.upsert({
    where: { userId_orgId: { userId: 'user_va_001', orgId: 'org_test_001' } },
    update: {
      role: 'VA',
      status: 'ACTIVE',
      payRate: 15.0,
    },
    create: {
      userId: 'user_va_001',
      orgId: 'org_test_001',
      role: 'VA',
      status: 'ACTIVE',
      payRate: 15.0,
    },
  });
  console.log(`  Membership: ${membership.id} (VA, $15/hr)`);

  // 4. Upsert projects
  const projComms = await prisma.project.upsert({
    where: { id: 'proj_comms_001' },
    update: {
      name: 'Client Communications',
      orgId: 'org_test_001',
      status: 'ACTIVE',
      requireTask: false,
      color: '#4F46E5',
    },
    create: {
      id: 'proj_comms_001',
      name: 'Client Communications',
      orgId: 'org_test_001',
      status: 'ACTIVE',
      requireTask: false,
      color: '#4F46E5',
    },
  });
  console.log(`  Project: ${projComms.id} (${projComms.name})`);

  const projAdmin = await prisma.project.upsert({
    where: { id: 'proj_admin_001' },
    update: {
      name: 'Administrative Tasks',
      orgId: 'org_test_001',
      status: 'ACTIVE',
      requireTask: false,
      color: '#059669',
    },
    create: {
      id: 'proj_admin_001',
      name: 'Administrative Tasks',
      orgId: 'org_test_001',
      status: 'ACTIVE',
      requireTask: false,
      color: '#059669',
    },
  });
  console.log(`  Project: ${projAdmin.id} (${projAdmin.name})`);

  // 5. Upsert tasks for Client Communications
  const commsTasks = [
    { id: 'task_email_001', title: 'Email Management', sortOrder: 1 },
    { id: 'task_calls_001', title: 'Client Calls', sortOrder: 2 },
    { id: 'task_followup_001', title: 'Follow-up Messages', sortOrder: 3 },
  ];

  for (const t of commsTasks) {
    const task = await prisma.task.upsert({
      where: { id: t.id },
      update: { title: t.title, status: 'OPEN', sortOrder: t.sortOrder, projectId: 'proj_comms_001' },
      create: { id: t.id, title: t.title, status: 'OPEN', sortOrder: t.sortOrder, projectId: 'proj_comms_001' },
    });
    console.log(`  Task: ${task.id} (${task.title})`);
  }

  // 6. Upsert tasks for Administrative Tasks
  const adminTasks = [
    { id: 'task_entry_001', title: 'Data Entry', sortOrder: 1 },
    { id: 'task_research_001', title: 'Research', sortOrder: 2 },
    { id: 'task_reports_001', title: 'Report Writing', sortOrder: 3 },
  ];

  for (const t of adminTasks) {
    const task = await prisma.task.upsert({
      where: { id: t.id },
      update: { title: t.title, status: 'OPEN', sortOrder: t.sortOrder, projectId: 'proj_admin_001' },
      create: { id: t.id, title: t.title, status: 'OPEN', sortOrder: t.sortOrder, projectId: 'proj_admin_001' },
    });
    console.log(`  Task: ${task.id} (${task.title})`);
  }

  // 7. Upsert task assignments (user_va_001 assigned to all 6 tasks)
  const allTaskIds = [
    ...commsTasks.map((t) => t.id),
    ...adminTasks.map((t) => t.id),
  ];

  for (const taskId of allTaskIds) {
    const assignment = await prisma.taskAssignment.upsert({
      where: { userId_taskId: { userId: 'user_va_001', taskId } },
      update: {},
      create: { userId: 'user_va_001', taskId },
    });
    console.log(`  TaskAssignment: ${assignment.id} (user_va_001 -> ${taskId})`);
  }

  console.log('\nSeed complete!');
  console.log('  1 User, 1 Organization, 1 Membership');
  console.log('  2 Projects, 6 Tasks, 6 TaskAssignments');
  console.log('\nTest API key: Bearer vt_test123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
