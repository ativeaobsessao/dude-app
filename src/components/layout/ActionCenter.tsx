import { useState, type FormEvent, useMemo, useEffect } from 'react';
import { useTimerStore } from '../../store/useTimerStore';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, X, ArrowLeft, ArrowRight, Layers, Target, Clock, 
  StickyNote, History, FolderKanban, Search, Trash2,
  CircleX, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { sendToServiceWorker } from '../../hooks/useServiceWorker';
import { formatHumanTime } from '../../lib/utils';

type Screen = 'session' | 'projects' | 'activities' | 'notes' | 'habits' | 'history';

import { CustomSelect } from '../ui/CustomSelect';

export const ActionCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'project' | 'activity' | 'habit' | 'note' | 'session', name: string } | null>(null);
  const [showListModal, setShowListModal] = useState<'projects' | 'activities' | null>(null);

  const timer = useTimerStore();
  const dataStore = useDataStore();
  const { user } = useAuthStore();

  // Reset screen when opening/closing
  useEffect(() => {
    if (isOpen && currentScreen === null) {
      // Normal open, reset to menu if it was closed
    }
  }, [isOpen]);

  // Global event listener for opening to specific screen
  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      if (e.detail?.screen) {
        setCurrentScreen(e.detail.screen);
      } else {
        setCurrentScreen(null);
      }
    };
    window.addEventListener('open-action-center', handleOpen);
    return () => window.removeEventListener('open-action-center', handleOpen);
  }, []);

  // Session States
  const [sessionData, setSessionData] = useState({
    activityId: '',
    activityManual: '',
    project: '',
    habit: '',
    description: '',
    hours: 0,
    minutes: 25,
    date: new Date().toISOString().split('T')[0]
  });

  // Activity States
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityProject, setNewActivityProject] = useState('');

  // Project/Habit/Note States
  const [newProjectName, setNewProjectName] = useState('');
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitFrequency, setNewHabitFrequency] = useState(3);
  const [newHabitDuration, setNewHabitDuration] = useState(0);
  const [newHabitTime, setNewHabitTime] = useState('morning');
  const [showHabitsModal, setShowHabitsModal] = useState(false);
  const [registeringHabit, setRegisteringHabit] = useState<string | null>(null);
  const [manualSessionDuration, setManualSessionDuration] = useState<number>(30);
  const [noteText, setNoteText] = useState('');
  const [noteProject, setNoteProject] = useState('');
  const [noteActivityId, setNoteActivityId] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);

  const [filterProject, setFilterProject] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const filteredActivities = useMemo(() => {
    if (!sessionData.project) return dataStore.activities;
    return dataStore.activities.filter(a => a.project_id === sessionData.project);
  }, [dataStore.activities, sessionData.project]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleStartSession = async (e: FormEvent) => {
    e.preventDefault();
    let finalActivityName = '';
    if (sessionData.activityId) {
      finalActivityName = dataStore.activities.find(a => a.id === sessionData.activityId)?.name || '';
    } else {
      finalActivityName = sessionData.activityManual;
    }

    // Activity name is NOT mandatory anymore, default to "Sessão Sem Título" if empty
    const activityName = finalActivityName || 'Sessão Sem Título';
    
    const totalMinutes = (Number(sessionData.hours) * 60) + Number(sessionData.minutes);
    if (totalMinutes < 1) return; // Validation: 1 min minimum
    
    // Auto-save note if description exists (Form 2)
    if (sessionData.description.trim() && user) {
      await dataStore.addNote(
        user.id,
        sessionData.description,
        sessionData.project || undefined,
        sessionData.activityId || undefined
      );
    }

    timer.start(
      totalMinutes, 
      activityName, 
      sessionData.project || undefined, 
      sessionData.habit || undefined,
      sessionData.description,
      sessionData.date
    );
    setIsOpen(false);
  };

  const handleAddActivity = async () => {
    if (!newActivityName || !user) return;
    await dataStore.addActivity(user.id, newActivityName, newActivityProject || undefined);
    setNewActivityName('');
    setNewActivityProject('');
    showSuccess('Atividade salva com sucesso!');
  };

  const handleAddProject = async () => {
    if (!newProjectName || !user) return;
    await dataStore.addProject(user.id, newProjectName);
    setNewProjectName('');
    showSuccess('Projeto salvo com sucesso!');
  };

  const handleAddHabit = async () => {
    if (!newHabitName.trim() || !user) {
      showSuccess('Por favor, insira o nome do hábito.');
      return;
    }
    if (!newHabitFrequency || newHabitFrequency < 1) {
      showSuccess('Por favor, selecione a frequência semanal.');
      return;
    }
    if (!newHabitDuration || newHabitDuration < 1) {
      showSuccess('Por favor, insira a duração por sessão.');
      return;
    }
    if (!newHabitTime) {
      showSuccess('Por favor, selecione o melhor horário.');
      return;
    }

    await dataStore.addHabit(
      user.id,
      newHabitName.trim(),
      newHabitFrequency,
      newHabitDuration,
      newHabitTime as 'morning' | 'afternoon' | 'evening'
    );

    setNewHabitName('');
    setNewHabitFrequency(3);
    setNewHabitDuration(0);
    setNewHabitTime('morning');
    showSuccess('✅ Hábito criado com sucesso!');
  };

  const handleAddNote = async () => {
    if (!noteText || !user) return;
    await dataStore.addNote(
      user.id, 
      noteText, 
      noteProject || undefined,
      noteActivityId || undefined
    );
    setNoteText('');
    setNoteProject('');
    setNoteActivityId('');
    showSuccess('✅ Anotação salva!');
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    if (type === 'project') await dataStore.deleteProject(id);
    if (type === 'activity') await dataStore.deleteActivity(id);
    if (type === 'habit') await dataStore.deleteHabit(id);
    if (type === 'note') await dataStore.deleteNote(id);
    if (type === 'session') await dataStore.deleteSession(id);
    setDeleteConfirm(null);
  };

  const inputClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all placeholder:text-text-secondary/50 touch-manipulation min-h-[44px]";
  const labelClasses = "text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-70 mb-2 block";
  const selectClasses = "w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green transition-all touch-manipulation min-h-[44px] cursor-pointer appearance-none px-4";

  const renderMenu = () => {
    const menuItems: { id: Screen, label: string, subtitle: string }[] = [
      {
        id: 'session',
        label: 'SESSÃO PROFUNDA',
        subtitle: 'Vai usar seu tempo para qual finalidade? Controle seu tempo agora!'
      },
      {
        id: 'projects',
        label: 'PROJETOS',
        subtitle: 'Liste todos os projetos que você precisa executar.'
      },
      {
        id: 'activities',
        label: 'ATIVIDADES',
        subtitle: 'Defina as tarefas padrões que seus projetos demandam.'
      },
      {
        id: 'notes',
        label: 'ANOTAÇÕES',
        subtitle: 'Seu espaço para registrar o que não pode ser esquecido.'
      },
      {
        id: 'habits',
        label: 'HÁBITOS ATÔMICOS',
        subtitle: 'Tudo aquilo que você pratica repetidamente, se torna um hábito.'
      },
      {
        id: 'history',
        label: 'HISTÓRICO',
        subtitle: 'Seu passado operacional revela seus padrões de execução.'
      }
    ];

    return (
      <div className="w-full max-w-lg space-y-0">
        {menuItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => setCurrentScreen(item.id)}
              className="w-full py-5 px-6 bg-surface/40 border border-white/10 rounded-2xl text-left hover:border-primary-green/40 active:scale-95 transition-all duration-200"
            >
              <span className="text-lg font-bold text-text-primary tracking-tight block">
                {item.label}
              </span>
            </button>
            <p className="text-xs text-text-secondary/60 px-2 mt-2 mb-4">
              {item.subtitle}
            </p>
          </div>
        ))}
        
        <div className="pt-4">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-4 border border-primary-green/30 text-primary-green rounded-2xl font-bold uppercase tracking-widest text-sm hover:bg-primary-green/10 transition-all"
          >
            ← Voltar
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        data-action-center-trigger="true"
        className="fixed bottom-12 right-12 z-[100] w-16 h-16 bg-primary-green text-background rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(110,231,168,0.3)] hover:scale-110 active:scale-95 transition-all duration-300 group touch-manipulation"
      >
        <Plus size={32} className={`transition-transform duration-500 ${isOpen ? 'rotate-45' : ''}`} />
        <div className="absolute inset-0 rounded-full bg-primary-green animate-ping opacity-20 pointer-events-none" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-3xl flex flex-col items-center px-6 py-12 md:py-24 overflow-y-auto"
          >
            <div className="w-full max-w-4xl space-y-12 pb-32">
              <header className="flex justify-between items-center border-b border-white/5 pb-8">
                <div className="flex items-center gap-4">
                  {currentScreen !== null && (
                    <button 
                      onClick={() => setCurrentScreen(null)}
                      className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px]"
                    >
                      <ArrowLeft size={16} /> Voltar
                    </button>
                  )}
                  <div className="space-y-1">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-text-secondary opacity-40">Centro de Operações</h2>
                    <p className="text-[8px] text-primary-green/60 font-mono text-left">MODO EXECUÇÃO ATIVADO</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-primary-green transition-all"
                >
                  <X size={18} />
                </button>
              </header>

              {successMessage && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary-green/10 border border-primary-green/20 p-4 rounded-xl flex items-center gap-3 text-primary-green text-xs font-bold uppercase tracking-widest">
                  <CheckCircle2 size={16} /> {successMessage}
                </motion.div>
              )}

              <div className="flex flex-col items-center">
                {currentScreen === null && renderMenu()}
                
                {currentScreen === 'session' && (
                  <div className="w-full max-w-2xl space-y-10">
                    <h3 className="text-3xl font-bold tracking-tight text-text-primary text-center">Sessão Profunda</h3>
                    {timer.isActive ? (
                       <div className="bg-surface/30 border border-primary-green/20 p-10 rounded-[2.5rem] text-center space-y-6">
                         <p className="text-primary-green/60 font-mono text-xs uppercase tracking-widest">Sessão em curso</p>
                         <h4 className="text-4xl font-light text-text-primary tracking-tight">{timer.activityName}</h4>
                         <button onClick={() => setShowCancelConfirm(true)} className="px-10 py-4 border border-white/10 text-text-secondary hover:text-red-400 hover:border-red-400/30 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all min-h-[44px]">Cancelar Sessão</button>
                       </div>
                    ) : (
                      <div className="space-y-8 bg-surface/10 p-8 rounded-[2.5rem] border border-white/5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-1 text-left">
                            <label className={labelClasses}>Projeto (opcional)</label>
                            <CustomSelect
                              value={sessionData.project}
                              onChange={val => setSessionData({...sessionData, project: val, activityId: ''})}
                              placeholder="Geral (Sem Projeto)"
                              options={[
                                { value: '', label: 'Geral (Sem Projeto)' },
                                ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                              ]}
                            />
                          </div>
                          <div className="space-y-1 text-left">
                            <label className={labelClasses}>Atividade (opcional)</label>
                            <CustomSelect
                              className={!!sessionData.activityManual ? 'opacity-50 pointer-events-none' : ''}
                              value={sessionData.activityId}
                              onChange={val => setSessionData({...sessionData, activityId: val})}
                              placeholder="Selecionar Atividade"
                              options={[
                                { value: '', label: 'Selecionar Atividade' },
                                ...filteredActivities.map(a => ({ value: a.id, label: a.name }))
                              ]}
                            />
                          </div>
                        </div>
                        <div className="space-y-1 text-left">
                          <label className={labelClasses}>Atividade Avulsa (opcional)</label>
                          <input
                            disabled={!!sessionData.activityId}
                            autoComplete="off" autoCorrect="off" enterKeyHint="done" inputMode="text"
                            placeholder="Atividade sem projeto..."
                            className={inputClasses}
                            value={sessionData.activityManual}
                            onChange={e => setSessionData({...sessionData, activityManual: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1 text-left">
                          <label className={labelClasses}>Vincular Hábito (opcional)</label>
                          <CustomSelect
                            value={sessionData.habit}
                            onChange={val => setSessionData({...sessionData, habit: val})}
                            placeholder="Nenhum"
                            options={[
                              { value: '', label: 'Nenhum' },
                              ...dataStore.habits.map(h => ({ 
                                value: h.id, 
                                label: `${h.name} (${h.sessions_this_week}/${h.sessions_per_week} esta semana)`
                              }))
                            ]}
                          />
                        </div>
                        <div className="space-y-1 text-left">
                          <label className={labelClasses}>ANOTAÇÃO</label>
                          <textarea
                            autoComplete="off" autoCorrect="off" enterKeyHint="send" inputMode="text"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleStartSession(e as unknown as FormEvent);
                              }
                            }}
                            placeholder="Precisa realizar alguma anotação para se lembrar durante a Sessão Profunda?"
                            className={`${inputClasses} h-32 resize-none`}
                            value={sessionData.description}
                            onChange={e => setSessionData({...sessionData, description: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-6 items-end">
                           <div className="col-span-2 grid grid-cols-2 gap-4">
                              {/* HORAS */}
                              <div className="space-y-1 text-left">
                                <label className={labelClasses}>Horas</label>
                                <input
                                  type="tel"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={2}
                                  enterKeyHint="done"
                                  placeholder="0"
                                  className={`${inputClasses} text-center text-2xl font-bold`}
                                  value={sessionData.hours === 0 ? '' : sessionData.hours}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    const num = parseInt(val) || 0;
                                    setSessionData({...sessionData, hours: Math.min(12, num)});
                                  }}
                                  onBlur={(e) => {
                                    if (!e.target.value) {
                                      setSessionData({...sessionData, hours: 0});
                                    }
                                    e.target.blur();
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                              </div>

                              {/* MINUTOS */}
                              <div className="space-y-1 text-left">
                                <label className={labelClasses}>Minutos</label>
                                <input
                                  type="tel"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={2}
                                  enterKeyHint="done"
                                  placeholder="25"
                                  className={`${inputClasses} text-center text-2xl font-bold`}
                                  value={sessionData.minutes === 0 ? '' : sessionData.minutes}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    const num = parseInt(val) || 0;
                                    setSessionData({...sessionData, minutes: Math.min(59, num)});
                                  }}
                                  onBlur={(e) => {
                                    if (!e.target.value) {
                                      setSessionData({...sessionData, minutes: 0});
                                    }
                                    e.target.blur();
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                              </div>
                           </div>
                           <button
                             onClick={handleStartSession}
                             disabled={(sessionData.hours === 0 && sessionData.minutes === 0)}
                             className="w-full py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-[0_0_40px_rgba(110,231,168,0.2)] disabled:opacity-20 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                           >
                             INICIAR <ArrowRight size={14} />
                           </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentScreen === 'projects' && (
                  <div className="w-full max-w-2xl space-y-10">
                    <h3 className="text-3xl font-bold tracking-tight text-text-primary text-center">Projetos</h3>
                    <div className="bg-surface/10 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                      <div className="space-y-1 text-left">
                        <label className={labelClasses}>Nome do Projeto</label>
                        <input
                          autoComplete="off" autoCorrect="off" enterKeyHint="done" inputMode="text"
                          placeholder="Novo Projeto..."
                          className={inputClasses}
                          value={newProjectName}
                          onChange={e => setNewProjectName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddProject()}
                        />
                      </div>
                      <button onClick={handleAddProject} className="w-full py-5 bg-white/10 hover:bg-white/20 rounded-2xl font-bold uppercase tracking-widest text-[10px] text-text-primary transition-all min-h-[44px]">Salvar Projeto</button>
                    </div>
                    <div className="flex justify-center">
                      <button onClick={() => setShowListModal('projects')} className="text-[10px] font-bold uppercase tracking-widest text-primary-green border-b border-primary-green/30 pb-1">Ver todos os projetos</button>
                    </div>
                  </div>
                )}

                {currentScreen === 'activities' && (
                  <div className="w-full max-w-2xl space-y-10">
                    <h3 className="text-3xl font-bold tracking-tight text-text-primary text-center">Atividades</h3>
                    <div className="bg-surface/10 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                      <div className="space-y-1 text-left">
                        <label className={labelClasses}>Nome da Atividade</label>
                        <input
                          autoComplete="off" autoCorrect="off" enterKeyHint="done" inputMode="text"
                          placeholder="Ex: Refatoração, Estudo, Reunião..."
                          className={inputClasses}
                          value={newActivityName}
                          onChange={e => setNewActivityName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className={labelClasses}>Vincular Projeto (Opcional)</label>
                        <CustomSelect
                          value={newActivityProject}
                          onChange={val => setNewActivityProject(val)}
                          placeholder="Geral (Sem Projeto)"
                          options={[
                            { value: '', label: 'Geral (Sem Projeto)' },
                            ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                          ]}
                        />
                      </div>
                      <button onClick={handleAddActivity} className="w-full py-5 bg-white/10 hover:bg-white/20 rounded-2xl font-bold uppercase tracking-widest text-[10px] text-text-primary transition-all min-h-[44px]">Salvar Atividade</button>
                    </div>
                    <div className="flex justify-center">
                      <button onClick={() => setShowListModal('activities')} className="text-[10px] font-bold uppercase tracking-widest text-primary-green border-b border-primary-green/30 pb-1">Ver todas as atividades</button>
                    </div>
                  </div>
                )}

                {currentScreen === 'notes' && (
                  <div className="w-full max-w-2xl space-y-10">
                    <h3 className="text-3xl font-bold tracking-tight text-text-primary text-center">Anotações</h3>
                    <div className="bg-surface/10 p-8 rounded-[2.5rem] border border-white/5 space-y-8">
                      <div className="flex justify-between items-center border-b border-white/5 pb-4">
                        <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest px-1">Nova Anotação</span>
                        <span className="text-[10px] font-bold text-primary-green/60 uppercase tracking-widest">
                          {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1 text-left">
                          <label className={labelClasses}>Projeto (opcional)</label>
                          <CustomSelect
                            value={noteProject}
                            onChange={val => {setNoteProject(val); setNoteActivityId('');}}
                            placeholder="Sem Projeto"
                            options={[
                              { value: '', label: 'Sem Projeto' },
                              ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                            ]}
                          />
                        </div>
                        <div className="space-y-1 text-left">
                          <label className={labelClasses}>Atividade (opcional)</label>
                          <CustomSelect
                            value={noteActivityId}
                            onChange={val => setNoteActivityId(val)}
                            placeholder="Sem Atividade"
                            options={[
                              { value: '', label: 'Sem Atividade' },
                              ...(noteProject ? dataStore.activities.filter(a => a.project_id === noteProject) : dataStore.activities).map(a => ({ value: a.id, label: a.name }))
                            ]}
                          />
                        </div>
                      </div>
                      <div className="space-y-1 text-left">
                        <label className={labelClasses}>O que não pode esquecer?</label>
                        <textarea
                          autoComplete="off" autoCorrect="off" enterKeyHint="send" inputMode="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddNote();
                            }
                          }}
                          placeholder="Algo importante que não pode esquecer?"
                          className={`${inputClasses} h-40 resize-none`}
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                        />
                      </div>
                      <button onClick={handleAddNote} disabled={!noteText} className="w-full py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-[0_0_40px_rgba(110,231,168,0.2)] transition-all min-h-[44px] disabled:opacity-20 touch-manipulation">Salvar Registro</button>
                    </div>

                    <div className="flex justify-center text-center pb-20">
                      <button 
                        onClick={() => {
                          // Close action center and signal to open history in RecentNotes
                          setIsOpen(false);
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('open-notes-history'));
                          }, 300);
                        }}
                        className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-green border-b border-primary-green/20 pb-1 touch-manipulation"
                      >
                        VER TODAS AS ANOTAÇÕES
                      </button>
                    </div>
                  </div>
                )}

                {currentScreen === 'history' && (
                  <div className="w-full max-w-4xl space-y-12">
                    <div className="flex flex-col items-center gap-10">
                      <h3 className="text-3xl font-bold tracking-tight text-text-primary text-center uppercase tracking-[0.2em]">Histórico de Sessões Profundas</h3>
                      
                      {/* Filters */}
                      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 pb-8 border-b border-white/5">
                        <div className="space-y-2 text-left">
                          <label className={labelClasses}>Filtrar por Projeto</label>
                          <CustomSelect
                            value={filterProject}
                            onChange={val => setFilterProject(val)}
                            placeholder="Todos os Projetos"
                            options={[
                              { value: '', label: 'Todos os Projetos' },
                              ...dataStore.projects.map(p => ({ value: p.id, label: p.name }))
                            ]}
                          />
                        </div>
                        <div className="space-y-2 text-left">
                          <label className={labelClasses}>Filtrar por Data</label>
                          <input 
                            type="date"
                            className={inputClasses}
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="w-full space-y-4 pb-32">
                        {dataStore.sessions
                          .filter(session => {
                            const matchesProject = filterProject ? session.project_id === filterProject : true;
                            const sessionDateStr = new Date(session.started_at).toISOString().split('T')[0];
                            const matchesDate = filterDate ? sessionDateStr === filterDate : true;
                            return matchesProject && matchesDate;
                          })
                          .length === 0 ? (
                            <p className="text-text-secondary/30 italic text-center py-20">Nenhum registro encontrado.</p>
                          ) : (
                            dataStore.sessions
                              .filter(session => {
                                const matchesProject = filterProject ? session.project_id === filterProject : true;
                                const sessionDateStr = new Date(session.started_at).toISOString().split('T')[0];
                                const matchesDate = filterDate ? sessionDateStr === filterDate : true;
                                return matchesProject && matchesDate;
                              })
                              .map(session => (
                                <div key={session.id} className="flex justify-between items-center py-6 border-b border-white/10 group">
                                  <div className="space-y-1">
                                    <span className="text-lg font-light text-text-primary group-hover:text-primary-green transition-colors">{session.activity_name}</span>
                                    <p className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">
                                      {dataStore.projects.find(p => p.id === session.project_id)?.name || 'Geral'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-6 text-right">
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold text-text-primary tracking-tight">{formatHumanTime(session.duration_minutes)}</p>
                                      <p className="text-[10px] font-bold text-primary-green/60 uppercase tracking-widest leading-none">
                                        {(() => {
                                           const d = new Date(session.started_at);
                                           const day = d.getDate().toString().padStart(2, '0');
                                           const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                           return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
                                        })()}
                                      </p>
                                    </div>
                                    <button 
                                      onClick={() => setDeleteConfirm({ id: session.id, type: 'session', name: session.activity_name })}
                                      className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all md:opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              ))
                          )
                        }
                      </div>
                    </div>
                  </div>
                )}

                                {currentScreen === 'habits' && (
                  <div className="w-full max-w-2xl space-y-10 flex flex-col items-stretch">
                    <button
                      onClick={() => setCurrentScreen(null)}
                      className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-all font-bold uppercase tracking-widest text-[10px] self-start"
                    >
                      ← Voltar
                    </button>

                    {/* SEÇÃO 1 — Criar novo hábito */}
                    <div className="space-y-4 text-left">
                      <div>
                        <h3 className="text-3xl font-bold tracking-tight text-text-primary">Novo Hábito</h3>
                        <p className="text-xs text-text-secondary/60 mt-1">Configure sua prática e construa consistência.</p>
                      </div>
                      
                      <div className="bg-surface/10 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                        <div className="space-y-1">
                          <label className={labelClasses}>NOME DO HÁBITO</label>
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            enterKeyHint="done"
                            inputMode="text"
                            placeholder="Ex: Leitura, Exercício, Meditação..."
                            className={inputClasses}
                            value={newHabitName}
                            onChange={e => setNewHabitName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            onBlur={() => {
                              // Não salva ao sair do campo — apenas fecha o teclado
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={labelClasses}>QUANTAS VEZES POR SEMANA?</label>
                          <CustomSelect
                            value={String(newHabitFrequency)}
                            onChange={(val) => setNewHabitFrequency(Number(val))}
                            placeholder="Vezes por semana"
                            options={[
                              { value: '1', label: '1x' },
                              { value: '2', label: '2x' },
                              { value: '3', label: '3x' },
                              { value: '4', label: '4x' },
                              { value: '5', label: '5x' },
                              { value: '6', label: '6x' },
                              { value: '7', label: '7x por semana' }
                            ]}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={labelClasses}>DURAÇÃO POR SESSÃO (minutos)</label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            enterKeyHint="done"
                            placeholder="Ex: 45"
                            className={`${inputClasses} text-center text-2xl font-bold`}
                            value={newHabitDuration === 0 ? '' : newHabitDuration}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setNewHabitDuration(parseInt(val) || 0);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={labelClasses}>MELHOR HORÁRIO</label>
                          <CustomSelect
                            value={newHabitTime}
                            onChange={(val) => setNewHabitTime(val)}
                            placeholder="Melhor horário"
                            options={[
                              { value: 'morning', label: '🌅 Manhã' },
                              { value: 'afternoon', label: '☀️ Tarde' },
                              { value: 'evening', label: '🌙 Noite' }
                            ]}
                          />
                        </div>
                        <button onClick={handleAddHabit} className="w-full py-5 bg-primary-green hover:brightness-110 text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-[0_0_30px_rgba(110,231,168,0.2)]">SALVAR HÁBITO</button>
                      </div>
                    </div>

                    {/* Divisor */}
                    <div className="border-t border-white/10 pt-4" />

                    <div className="flex justify-center">
                      <button
                        onClick={() => setShowHabitsModal(true)}
                        className="text-[10px] font-bold uppercase tracking-widest text-primary-green border-b border-primary-green/30 pb-1 hover:border-primary-green transition-all"
                      >
                        Ver Todos os Hábitos
                      </button>
                    </div>

                    {/* SEÇÃO 2 — Seus hábitos ativos */}
                    <div className="space-y-6 text-left">
                      <h3 className="text-2xl font-bold tracking-tight text-text-primary uppercase">SEUS HÁBITOS</h3>
                      
                      <div className="space-y-4">
                        {dataStore.habits.length === 0 ? (
                          <p className="text-text-secondary/40 font-light italic">Nenhum hábito ativo.</p>
                        ) : (
                          dataStore.habits.map(h => {
                            const total = h.sessions_per_week || 3;
                            const current = h.sessions_this_week || 0;
                            const dots = Array.from({ length: total }, (_, i) => i < current ? '●' : '○').join(' ');

                            return (
                              <div key={h.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-surface/5 border border-white/5 rounded-3xl gap-4">
                                <div className="space-y-1.5 text-left">
                                  <h4 className="text-lg font-semibold text-text-primary">{h.name}</h4>
                                  <div className="text-xs text-text-secondary/60">
                                    {{
                                      morning: '🌅 Manhã',
                                      afternoon: '☀️ Tarde',
                                      evening: '🌙 Noite'
                                    }[h.preferred_time] || h.preferred_time} · {h.minutes_per_session}min por sessão
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-primary-green text-sm tracking-widest font-bold">
                                      {dots}
                                    </span>
                                    <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest">
                                      {current}/{total} esta semana
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-3 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                                  <span className="text-xs font-bold text-primary-green font-mono">
                                    🔥 {h.weekly_streak} {h.weekly_streak === 1 ? 'semana' : 'semanas'} invictas
                                  </span>
                                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <button
                                      onClick={() => {
                                        setRegisteringHabit(h.id);
                                        setManualSessionDuration(h.minutes_per_session);
                                      }}
                                      className="text-[10px] font-bold uppercase tracking-widest text-primary-green/60 hover:text-primary-green border border-primary-green/20 hover:border-primary-green/40 px-3 py-1 rounded-full transition-all"
                                    >
                                      + Registrar sessão
                                    </button>
                                    <button 
                                      onClick={() => setDeleteConfirm({ id: h.id, type: 'habit', name: h.name })} 
                                      className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List Modals */}
      <AnimatePresence>
        {showHabitsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-background/98 backdrop-blur-3xl flex flex-col items-center px-6 py-12 overflow-y-auto"
          >
            <div className="w-full max-w-2xl space-y-10">
              <header className="flex justify-between items-center border-b border-white/5 pb-8">
                <button
                  onClick={() => setShowHabitsModal(false)}
                  className="flex items-center gap-2 text-text-secondary hover:text-primary-green transition-colors font-bold uppercase tracking-widest text-[10px]"
                >
                  ← Voltar
                </button>
                <h3 className="text-2xl font-bold text-text-primary tracking-tight">
                  Todos os Hábitos
                </h3>
                <button
                  onClick={() => setShowHabitsModal(false)}
                  className="w-10 h-10 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="space-y-4 pb-20">
                {dataStore.habits.length === 0 ? (
                  <p className="text-text-secondary/40 italic text-center py-20">
                    Nenhum hábito cadastrado ainda.
                  </p>
                ) : (
                  dataStore.habits.map(h => {
                    const total = h.sessions_per_week || 3;
                    const current = h.sessions_this_week || 0;
                    const preferredTimeLabel = {
                      morning: '🌅 Manhã',
                      afternoon: '☀️ Tarde',
                      evening: '🌙 Noite'
                    }[h.preferred_time] || h.preferred_time;

                    return (
                      <div key={h.id} className="p-6 bg-surface/10 border border-white/10 rounded-3xl space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="text-lg font-bold text-text-primary">{h.name}</h4>
                            <p className="text-xs text-text-secondary/60">
                              {preferredTimeLabel} · {h.minutes_per_session}min por sessão
                            </p>
                          </div>
                          <span className="text-sm font-bold text-primary-green">
                            🔥 {h.weekly_streak} {h.weekly_streak === 1 ? 'semana' : 'semanas'} invicta{h.weekly_streak !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Bolinhas de progresso */}
                        <div className="flex items-center gap-2">
                          {Array.from({ length: total }, (_, i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full transition-all ${
                                i < current
                                  ? 'bg-primary-green shadow-[0_0_8px_rgba(110,231,168,0.5)]'
                                  : 'bg-white/10'
                              }`}
                            />
                          ))}
                          <span className="text-[10px] font-bold text-text-secondary/40 uppercase tracking-widest ml-2">
                            {current}/{total} esta semana
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <p className="text-[10px] text-text-secondary/40 uppercase tracking-widest font-bold">
                            Criado em {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setRegisteringHabit(h.id);
                                setManualSessionDuration(h.minutes_per_session);
                                setShowHabitsModal(false);
                              }}
                              className="text-[10px] font-bold uppercase tracking-widest text-primary-green/60 hover:text-primary-green border border-primary-green/20 hover:border-primary-green/40 px-3 py-1 rounded-full transition-all"
                            >
                              + Registrar sessão
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm({ id: h.id, type: 'habit', name: h.name });
                                setShowHabitsModal(false);
                              }}
                              className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List Modals */}
      <AnimatePresence>
        {showListModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] bg-background/98 backdrop-blur-3xl flex flex-col items-center px-6 py-20 overflow-y-auto">
            <div className="w-full max-w-2xl space-y-12">
               <header className="flex justify-between items-center bg-white/5 -mx-6 -mt-20 p-10 border-b border-white/5 mb-8">
                 <h3 className="text-2xl font-bold text-text-primary tracking-tight">Listagem de {showListModal === 'projects' ? 'Projetos' : 'Atividades'}</h3>
                 <button onClick={() => setShowListModal(null)} className="w-12 h-12 rounded-full border border-border-white flex items-center justify-center text-text-secondary hover:text-white"><X size={20} /></button>
               </header>
               <div className="space-y-4">
                 {(showListModal === 'projects' ? dataStore.projects : dataStore.activities).map(item => (
                   <div key={item.id} className="p-6 bg-surface/40 border border-white/10 rounded-2xl flex justify-between items-center">
                     <div>
                       <h4 className="text-lg font-medium text-text-primary">{item.name}</h4>
                       <p className="text-[10px] text-text-secondary/40 font-bold uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                     </div>
                     <button 
                      onClick={() => setDeleteConfirm({ id: item.id, type: showListModal === 'projects' ? 'project' : 'activity', name: item.name })}
                      className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                     >
                       <Trash2 size={18} />
                     </button>
                   </div>
                 ))}
                 {(showListModal === 'projects' ? dataStore.projects : dataStore.activities).length === 0 && (
                   <p className="text-text-secondary/20 italic text-center py-20">Nenhum registro encontrado.</p>
                 )}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-surface border border-border-white/20 p-10 rounded-[2.5rem] text-center space-y-6">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32} /></div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-text-primary">
                  {deleteConfirm.type === 'habit' ? `Deseja excluir o hábito ${deleteConfirm.name}?` : `Deseja excluir ${deleteConfirm.name}?`}
                </h4>
                <p className="text-text-secondary text-sm font-light">
                  {deleteConfirm.type === 'habit' ? 'Todo o histórico será perdido.' : 'Esta ação não pode ser desfeita.'}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={handleDelete} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px]">Sim, excluir</button>
                <button onClick={() => setDeleteConfirm(null)} className="w-full py-4 bg-white/5 text-text-secondary rounded-2xl font-bold uppercase tracking-widest text-[10px]">Cancelar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Session Confirmation */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] bg-background/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-surface border border-white/10 p-12 rounded-[2.5rem] text-center space-y-8">
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={40} /></div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-text-primary">Cancelar sessão?</h3>
                <p className="text-text-secondary font-light">Seu progresso atual será descartado.</p>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={() => { sendToServiceWorker('CANCEL_TIMER'); timer.reset(); setShowCancelConfirm(false); setIsOpen(false); }} className="w-full py-5 text-red-500 font-bold uppercase tracking-widest text-[10px]">Sim, cancelar</button>
                <button onClick={() => setShowCancelConfirm(false)} className="w-full py-5 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px]">Continuar Sessão</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Habit Session Registration */}
      <AnimatePresence>
        {registeringHabit && (() => {
          const habit = dataStore.habits.find(h => h.id === registeringHabit);
          if (!habit) return null;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="w-full max-w-sm bg-surface border border-border-white/20 p-10 rounded-[2.5rem] text-center space-y-6">
                <div className="w-16 h-16 bg-primary-green/10 text-primary-green rounded-full flex items-center justify-center mx-auto">
                  <Clock size={32} />
                </div>
                <div className="space-y-4">
                  <h4 className="text-xl font-bold text-text-primary text-center">Registrar sessão — {habit.name}</h4>
                </div>
                <div className="space-y-2 text-left">
                  <label className={labelClasses}>DURAÇÃO</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Minutos"
                    className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-text-primary outline-none focus:border-primary-green text-center text-xl font-bold"
                    value={manualSessionDuration || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const num = parseInt(e.target.value) || 0;
                      setManualSessionDuration(num);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={async () => {
                      if (user && manualSessionDuration > 0) {
                        await dataStore.completeHabitSession(habit.id, user.id, manualSessionDuration);
                        setRegisteringHabit(null);
                        showSuccess('✅ Sessão registrada com sucesso!');
                      }
                    }} 
                    className="w-full py-4 bg-primary-green text-background rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(110,231,168,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    CONFIRMAR
                  </button>
                  <button 
                    onClick={() => setRegisteringHabit(null)} 
                    className="w-full py-4 bg-white/5 text-text-secondary rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                  >
                    CANCELAR
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
};

