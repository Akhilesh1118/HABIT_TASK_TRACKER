import dotenv from 'dotenv';
dotenv.config();

import { connectToDatabase } from '../server/services/mongoService';
import { TaskModel, HabitModel, HabitCompletionModel } from '../server/models/HabitData';

async function testApis() {
  console.log('=== RUNNING API ENDPOINT VERIFICATION ===');
  await connectToDatabase();

  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'PersonalPassword2026!';

  // 1. Authenticate
  console.log(`1. Testing /api/auth/login with ${adminEmail}...`);
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed: ${loginRes.status} ${text}`);
  }

  const loginData = await loginRes.json();
  console.log('   ✓ Login successful, session token acquired.');
  const token = loginData.token;
  const cookieHeader = loginRes.headers.get('set-cookie') || '';

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  if (cookieHeader) {
    authHeaders['Cookie'] = cookieHeader;
  }

  // 2. Test /api/auth/me
  console.log('2. Testing /api/auth/me...');
  const meRes = await fetch('http://localhost:3000/api/auth/me', { headers: authHeaders });
  const meData = await meRes.json();
  if (!meData.authenticated || !meData.user) {
    throw new Error('/api/auth/me did not return authenticated user');
  }
  console.log('   ✓ /api/auth/me verified:', meData.user.email);

  // 3. Test /api/sync (GET)
  console.log('3. Testing /api/sync (GET)...');
  const syncRes = await fetch('http://localhost:3000/api/sync', { headers: authHeaders });
  const syncData = await syncRes.json();
  if (!syncData.success || !Array.isArray(syncData.tasks) || !Array.isArray(syncData.habits)) {
    throw new Error('/api/sync failed');
  }
  console.log(`   ✓ /api/sync returned ${syncData.tasks.length} tasks and ${syncData.habits.length} habits.`);

  // 4. Test Task CRUD via /api/tasks
  console.log('4. Testing POST /api/tasks (Create Task)...');
  const createTaskRes = await fetch('http://localhost:3000/api/tasks', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'HTTP API Test Task',
      date: '2026-09-16',
      category: 'Technical',
      priority: 'high',
    }),
  });
  const createTaskData = await createTaskRes.json();
  if (!createTaskData.success || !createTaskData.task) {
    throw new Error('Create task failed');
  }
  const createdTaskId = createTaskData.task.id;
  console.log(`   ✓ Task created with ID: ${createdTaskId}`);

  // Check in MongoDB
  let mongoTask = await TaskModel.findOne({ id: createdTaskId }).lean();
  if (!mongoTask) throw new Error('Task not found in MongoDB after API creation');
  console.log('   ✓ Task verified in MongoDB Atlas');

  // Update Task
  console.log('5. Testing PUT /api/tasks/:id (Update Task)...');
  const updateTaskRes = await fetch(`http://localhost:3000/api/tasks/${createdTaskId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Updated HTTP API Task',
      completed: true,
    }),
  });
  const updateTaskData = await updateTaskRes.json();
  if (!updateTaskData.success || !updateTaskData.task.completed) {
    throw new Error('Update task failed');
  }
  mongoTask = await TaskModel.findOne({ id: createdTaskId }).lean();
  if (!mongoTask || !mongoTask.completed) throw new Error('Task completion not updated in MongoDB');
  console.log('   ✓ Task update verified in MongoDB Atlas');

  // Delete Task
  console.log('6. Testing DELETE /api/tasks/:id (Delete Task)...');
  const delTaskRes = await fetch(`http://localhost:3000/api/tasks/${createdTaskId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const delTaskData = await delTaskRes.json();
  if (!delTaskData.success) throw new Error('Delete task failed');
  mongoTask = await TaskModel.findOne({ id: createdTaskId }).lean();
  if (mongoTask) throw new Error('Task still exists in MongoDB after deletion');
  console.log('   ✓ Task deletion verified in MongoDB Atlas');

  // 7. Test Habit CRUD via /api/habits
  console.log('7. Testing POST /api/habits (Create Habit)...');
  const createHabitRes = await fetch('http://localhost:3000/api/habits', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'HTTP API Test Habit',
      category: 'Personal',
      frequency: 'daily',
      target: '20 mins',
      startDate: '2026-09-16',
      active: true,
    }),
  });
  const createHabitData = await createHabitRes.json();
  if (!createHabitData.success || !createHabitData.habit) {
    throw new Error('Create habit failed');
  }
  const createdHabitId = createHabitData.habit.id;
  console.log(`   ✓ Habit created with ID: ${createdHabitId}`);

  let mongoHabit = await HabitModel.findOne({ id: createdHabitId }).lean();
  if (!mongoHabit) throw new Error('Habit not found in MongoDB');
  console.log('   ✓ Habit verified in MongoDB Atlas');

  // Toggle Habit completion
  console.log('8. Testing POST /api/habits/:id/toggle (Toggle Habit Completion)...');
  const toggleRes = await fetch(`http://localhost:3000/api/habits/${createdHabitId}/toggle`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      date: '2026-09-16',
      completed: true,
    }),
  });
  const toggleData = await toggleRes.json();
  if (!toggleData.success || !toggleData.completed) throw new Error('Toggle habit failed');
  let mongoComp = await HabitCompletionModel.findOne({ habitId: createdHabitId, date: '2026-09-16' }).lean();
  if (!mongoComp || !mongoComp.completed) throw new Error('Habit completion not recorded in MongoDB');
  console.log('   ✓ Habit completion verified in MongoDB Atlas');

  // Delete Habit
  console.log('9. Testing DELETE /api/habits/:id (Delete Habit)...');
  const delHabitRes = await fetch(`http://localhost:3000/api/habits/${createdHabitId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const delHabitData = await delHabitRes.json();
  if (!delHabitData.success) throw new Error('Delete habit failed');
  mongoHabit = await HabitModel.findOne({ id: createdHabitId }).lean();
  mongoComp = await HabitCompletionModel.findOne({ habitId: createdHabitId }).lean();
  if (mongoHabit || mongoComp) throw new Error('Habit or completion still exists in MongoDB');
  console.log('   ✓ Habit and its completion deletion verified in MongoDB Atlas');

  console.log('\n=== ALL API ENDPOINTS AND MONGODB PERSISTENCE VERIFIED 100% ===');
  process.exit(0);
}

testApis().catch((err) => {
  console.error('API test failed:', err);
  process.exit(1);
});
