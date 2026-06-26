// ... (mantenha os imports)

export const TaskListScreen: React.FC<TaskListScreenProps> = ({ onStartSession }) => {
  // ... (mantenha os estados iniciais)

  // 1. GATHER ALL ITEMS OF TODAY
  const todayItems = useMemo(() => {
    // Adicione um filtro de segurança para garantir que apenas tarefas com ID existam
    const todayTasks = dataStore.dailyTasks.filter(t => t.task_date === todayStr && t.id);
    
    // ... (mantenha o resto da lógica de items)
    
    // Na hora de dar push no item, force um título padrão caso esteja vazio
    todayTasks.forEach(task => {
      items.push({
        id: `task-${task.id}`,
        type: 'daily_task',
        title: task.title || 'Tarefa sem título', // <--- SEGURANÇA AQUI
        is_completed: task.is_completed,
        raw: task
      });
    });

    // ... (resto da lógica de sort e retorno)
  }, [dataStore.dailyTasks, ...]);

  // ... (mantenha o resto do componente)
};
