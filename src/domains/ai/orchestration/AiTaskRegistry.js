function assertValidTask(task) {
  if (!task || typeof task !== 'object') {
    throw new Error('AI task must be an object.');
  }
  if (typeof task.id !== 'string' || !task.id.trim()) {
    throw new Error('AI task requires an id.');
  }
  if (typeof task.outputSchemaId !== 'string' || !task.outputSchemaId.trim()) {
    throw new Error(`AI task '${task.id}' requires an outputSchemaId.`);
  }
  if (!task.responseSchema || typeof task.responseSchema !== 'object') {
    throw new Error(`AI task '${task.id}' requires a responseSchema.`);
  }
  if (typeof task.buildPrompt !== 'function') {
    throw new Error(`AI task '${task.id}' requires buildPrompt().`);
  }
}

export function createAiTaskRegistry(initialTasks = []) {
  const tasks = new Map();

  function register(task) {
    assertValidTask(task);
    if (tasks.has(task.id)) {
      throw new Error(`AI task '${task.id}' is already registered.`);
    }
    tasks.set(task.id, Object.freeze({ ...task }));
  }

  for (const task of initialTasks) {
    register(task);
  }

  return Object.freeze({
    register,
    get(taskId) {
      return tasks.get(taskId) || null;
    },
    has(taskId) {
      return tasks.has(taskId);
    },
    list() {
      return Array.from(tasks.values());
    },
  });
}
