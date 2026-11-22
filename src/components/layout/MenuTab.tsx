import { useShallow } from 'zustand/react/shallow';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useDataStore } from '../../store/useDataStore';
import { calculateAvoidanceMetrics } from '../../lib/avoidanceMetrics';
import { AntiVicioCardOptionsModal } from '../dashboard/AntiVicioCardOptionsModal';
import type { Habit } from '../../types';
import { Plus, FolderKanban, Target, Layers, StickyNote, Link2, History, ChevronRight } from 'lucide-react';

export const MenuTab = () => {
  const dataStore = useDataStore(useShallow(state => ({
    activities: state.activities,
    avoidanceCheckins: state.avoidanceCheckins,
    habits: state.habits,
    projects: state.projects
  })));

  const [selectedAntiVicioHabit, setSelectedAntiVicioHabit] = useState<Habit | null>(null);
  
  const avoidHabits = dataStore.habits.filter(h => h.habit_mode === 'avoid');
  const projectsCount = dataStore.projects.length;
  const activitiesCount = dataStore.activities.length;
  const habitsCount = dataStore.habits.filter(h => h.habit_mode === 'build').length;

  const openScreen = (screenName: string, editHabit?: Habit) => {
    window.dispatchEvent(new CustomEvent('open-action-center', {
      detail: { screen: screenName, ...(editHabit ? { editHabit } : {}) }
    }));
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-6 pb-32 space-y-12 flex flex-col items-center">
      <div className="w-full max-w-lg space-y-12">
        {/* NÍVEL 1: O Acelerador (Topo) */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40 pl-2">
            AGENDAMENTO DE TAREFAS
          </h3>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => openScreen('agenda')}
            className="w-full py-4 bg-primary-green text-background rounded-full font-bold uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(110,231,168,0.2)]"
          >
            REALIZAR AGENDAMENTO
          </motion.button>
        </div>

        {/* AUTOCONTROLE */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40 pl-2">
            Autocontrole
          </h3>
          <div 
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            className="overscroll-x-contain touch-pan-x flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-6 px-6 md:-mx-8 md:px-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {avoidHabits.map((habit) => {
              const metrics = calculateAvoidanceMetrics(habit, dataStore.avoidanceCheckins);
              const unit = metrics.unitPlural;
              return (
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  key={habit.id}
                  onClick={() => setSelectedAntiVicioHabit(habit)}
                  className="w-[85%] sm:w-[280px] shrink-0 snap-center bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex flex-col justify-between cursor-pointer"
                >
                  <div className="space-y-1">
                    <h3 className="text-4xl font-light text-white tracking-tight leading-none">
                      {metrics.bestStreak}
                    </h3>
                    <p className="mt-1 text-[11px] text-white/45">Recorde · {unit} consecutivos</p>
                    <h4 className="text-sm font-medium text-white/80 tracking-wide font-sans mt-2">
                      {habit.name}
                    </h4>
                    <p className="mt-1 text-[11px] text-white/45">Atual: {metrics.currentStreak} {unit} seguidos</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openScreen('anti-vicio', habit);
                    }}
                    className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-2xl font-semibold uppercase tracking-widest text-[10px]"
                  >
                    Editar acompanhamento
                  </button>
                </motion.div>
              );
            })}
              
            {/* Novo acompanhamento */}
            <motion.div
              whileTap={{ scale: 0.96 }}
              onClick={() => openScreen('anti-vicio')}
              className="w-[85%] sm:w-[280px] shrink-0 snap-center bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center cursor-pointer min-h-[160px] hover:bg-white/10 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/50 mb-3">
                <Plus size={24} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/60">
                Novo acompanhamento
              </span>
            </motion.div>
          </div>
        </div>

        {/* ORGANIZAÇÃO */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40 pl-2">
            Organização
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openScreen('projects')}
              className="aspect-square bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 flex flex-col items-start justify-between text-left hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                <FolderKanban size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{projectsCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/60">Projetos</p>
              </div>
            </motion.button>
              
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openScreen('activities')}
              className="aspect-square bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 flex flex-col items-start justify-between text-left hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                <Target size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{activitiesCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/60">Atividades</p>
              </div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openScreen('habits')}
              className="aspect-square bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 flex flex-col items-start justify-between text-left hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                <Layers size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{habitsCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/60">Hábitos</p>
              </div>
            </motion.button>
          </div>
        </div>

        {/* NÍVEL 4: Captura Secundária */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/40 pl-2">
            Captura
          </h3>
          <div className="bg-white/5 backdrop-blur-md rounded-3xl overflow-hidden border border-white/5">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openScreen('notes')}
              className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors border-b border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                  <StickyNote size={16} />
                </div>
                <span className="text-sm font-semibold text-text-primary">Anotações</span>
              </div>
              <ChevronRight size={16} className="text-text-secondary/40" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openScreen('saved-links')}
              className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                  <Link2 size={16} />
                </div>
                <span className="text-sm font-semibold text-text-primary">Links Úteis</span>
              </div>
              <ChevronRight size={16} className="text-text-secondary/40" />
            </motion.button>
          </div>
        </div>

        {/* NÍVEL 5: Arquivo Mestre (Base da Tela) */}
        <div className="pt-6">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => openScreen('history')}
            className="w-full p-5 bg-transparent border border-white/5 rounded-3xl flex items-center justify-between text-left hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-secondary">
                <History size={16} />
              </div>
              <span className="text-sm font-semibold text-text-primary">Histórico de Sessões Profundas</span>
            </div>
            <ChevronRight size={16} className="text-text-secondary/40" />
          </motion.button>
        </div>
      </div>

      {/* Opções do acompanhamento */}
      <AntiVicioCardOptionsModal
        isOpen={!!selectedAntiVicioHabit}
        habit={selectedAntiVicioHabit}
        onClose={() => setSelectedAntiVicioHabit(null)}
      />
    </div>
  );
};
