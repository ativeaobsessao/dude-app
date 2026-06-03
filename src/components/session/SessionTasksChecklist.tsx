import React, { useState, useRef, useEffect } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';

interface SessionTasksChecklistProps {
  tasks: string[];
  completedTasks: string[];
  onChangeTasks: (newTasks: string[]) => void;
  onChangeCompleted: (newCompleted: string[]) => void;
}

export const SessionTasksChecklist: React.FC<SessionTasksChecklistProps> = ({
  tasks,
  completedTasks,
  onChangeTasks,
  onChangeCompleted,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newWord, setNewWord] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleToggle = (task: string) => {
    if (completedTasks.includes(task)) {
      onChangeCompleted(completedTasks.filter(t => t !== task));
    } else {
      onChangeCompleted([...completedTasks, task]);
    }
  };

  const handleAdd = () => {
    const trimmed = newWord.trim();
    if (trimmed) {
      if (!tasks.includes(trimmed)) {
        onChangeTasks([...tasks, trimmed]);
      }
      setNewWord('');
    }
    setIsAdding(false);
  };

  const handleRemove = (task: string) => {
    onChangeTasks(tasks.filter(t => t !== task));
    onChangeCompleted(completedTasks.filter(t => t !== task));
  };

  return (
    <div className="space-y-2">
      {tasks.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {tasks.map((task, index) => {
            const isDone = completedTasks.includes(task);
            return (
              <div
                key={index}
                className="flex items-start justify-between gap-3 p-[10px] pl-[12px] pr-[12px] rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-all"
              >
                <div 
                  onClick={() => handleToggle(task)}
                  className="flex items-start gap-3 cursor-pointer flex-1 min-w-0 pt-[1px]"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center transition-all duration-150 shrink-0 select-none mt-[1px]"
                    style={{
                      backgroundColor: isDone ? '#6ee7b7' : 'transparent',
                      border: isDone ? 'none' : '1.5px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    {isDone && <Check size={10} className="text-[#0a1410] stroke-[3]" />}
                  </div>
                  <span
                    className="text-xs transition-colors duration-150 flex-1 whitespace-normal break-words"
                    style={{
                      color: isDone ? '#6a7570' : '#ffffff',
                      textDecoration: isDone ? 'line-through' : 'none',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {task}
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleRemove(task)}
                  className="text-text-secondary/35 hover:text-red-400 transition-colors cursor-pointer p-1 shrink-0 mt-[1px]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isAdding ? (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-primary-green placeholder-text-secondary/30"
            placeholder="Nome da nova tarefa..."
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setNewWord('');
              }
            }}
            onBlur={handleAdd}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs transition-all cursor-pointer"
          style={{
            backgroundColor: 'rgba(110, 231, 183, 0.04)',
            border: '0.5px dashed rgba(110, 231, 183, 0.2)',
            color: '#6ee7b7',
          }}
        >
          <Plus size={14} />
          <span>ADICIONAR TAREFA</span>
        </button>
      )}
    </div>
  );
};
