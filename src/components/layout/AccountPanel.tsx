import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { X, Camera, User, Mail, Lock, LogOut, Check, Trash2, Download, Upload, Database } from 'lucide-react';

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | undefined;
  user: any;
  onSignOut: () => void;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  isOpen,
  onClose,
  userEmail,
  user,
  onSignOut
}) => {
  const dataStore = useDataStore();
  const profile = dataStore.profile;

  const [fullName, setFullName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  
  const [isRequestingRecovery, setIsRequestingRecovery] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [pendingImportPayload, setPendingImportPayload] = useState<any>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportIdentity = () => {
    if (!user?.id) return;
    
    const p = dataStore.profile;
    const name = p?.full_name || 'Usuário';
    const email = userEmail || 'desconhecido';
    const minutes = p?.total_focus_minutes || 0;
    const streak = p?.current_streak || 0;
    
    let md = `# 💾 DUDE - IDENTITY VAULT & BACKUP\n`;
    md += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
    md += `Email do Usuário: ${email}\n\n`;
    md += `---\n\n`;
    md += `## 📊 RELATÓRIO EXECUTIVO & VISÃO GERAL (IA-READY)\n\n`;
    md += `- **Agente Proprietário:** ${name}\n`;
    md += `- **Tempo Total Focado:** ${minutes} minutos\n`;
    md += `- **Ofensiva Atual (Streak):** ${streak} dias\n\n`;
    
    md += `### 📁 PROJETOS CADASTRADOS (${dataStore.projects?.length || 0})\n`;
    md += `| Nome do Projeto | ID |\n`;
    md += `| :--- | :--- |\n`;
    (dataStore.projects || []).forEach(proj => {
      md += `| ${proj.name} | ${proj.id} |\n`;
    });
    md += `\n`;

    md += `### ⚡ HÁBITOS CULTIVADOS (${dataStore.habits?.length || 0})\n`;
    md += `| Nome do Hábito | Frequência Semanal | Duração por Sessão | Período |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    (dataStore.habits || []).forEach(h => {
      md += `| ${h.name} | ${h.sessions_per_week}x | ${h.minutes_per_session} min | ${h.preferred_time === 'morning' ? '🌅 Manhã' : h.preferred_time === 'afternoon' ? '☀️ Tarde' : '🌙 Noite'} |\n`;
    });
    md += `\n`;

    md += `### 📋 ATIVIDADES REGISTRADAS (${dataStore.activities?.length || 0})\n`;
    md += `| Nome da Atividade | ID |\n`;
    md += `| :--- | :--- |\n`;
    (dataStore.activities || []).forEach(act => {
      md += `| ${act.name} | ${act.id} |\n`;
    });
    md += `\n`;

    md += `### ⏳ SESSÕES DE FOCO COMPLEMENTADAS (${dataStore.sessions?.length || 0})\n`;
    md += `| Assunto | Duração | Data | Concluída com Sucesso? |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    (dataStore.sessions || []).slice(0, 15).forEach(s => {
      md += `| ${s.activity_name || 'Sessão Sem Nome'} | ${s.duration_minutes} min | ${new Date(s.started_at).toLocaleString('pt-BR')} | ${s.completed ? 'Sim' : 'Não'} |\n`;
    });
    if ((dataStore.sessions || []).length > 15) {
      md += `| *E mais ${(dataStore.sessions || []).length - 15} sessões no arquivo de dados* | | | |\n`;
    }
    md += `\n`;

    md += `### 📈 REGISTRO DE HUMOR E ENERGIA (${dataStore.moodEntries?.length || 0})\n`;
    md += `| Data | Período | Humor | Energia |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    (dataStore.moodEntries || []).slice(0, 15).forEach(m => {
      md += `| ${m.date} | ${m.period} | ${m.mood || 'Neutro'} | ${m.energy || 'Normal'} |\n`;
    });
    if ((dataStore.moodEntries || []).length > 15) {
      md += `| *E mais ${(dataStore.moodEntries || []).length - 15} registros no arquivo de dados* | | | |\n`;
    }
    md += `\n`;

    md += `### 🛡️ PREVENÇÃO E AUTOCONTROLE (${dataStore.avoidanceCheckins?.length || 0})\n`;
    md += `| Data | Período | Status / Resultado | Gatilho / Observação |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    (dataStore.avoidanceCheckins || []).slice(0, 15).forEach(av => {
      md += `| ${new Date(av.created_at).toLocaleString('pt-BR')} | ${av.checkin_period} | ${av.status} | ${av.trigger_note || 'Sem observações'} |\n`;
    });
    if ((dataStore.avoidanceCheckins || []).length > 15) {
      md += `| *E mais ${(dataStore.avoidanceCheckins || []).length - 15} check-ins no arquivo de dados* | | | |\n`;
    }
    md += `\n`;

    md += `### 🔗 LINKS RÁPIDOS SALVOS (${dataStore.savedLinks?.length || 0})\n`;
    md += `| Título | URL |\n`;
    md += `| :--- | :--- |\n`;
    (dataStore.savedLinks || []).forEach(link => {
      md += `| ${link.title} | ${link.url} |\n`;
    });
    md += `\n`;

    md += `---\n\n`;
    md += `## 📦 DADOS DE RESTAURAÇÃO (JSON)\n`;
    md += `Este trecho contêm seu backup em formato codificado de alta integridade. Não altere os blocos abaixo para garantir a importação perfeita.\n\n`;
    md += `<!-- DUDE_RESTORE_VAULT_START -->\n`;
    
    const payload = {
      profile: dataStore.profile,
      projects: dataStore.projects,
      habits: dataStore.habits,
      habitCompletions: dataStore.habitCompletions,
      avoidanceCheckins: dataStore.avoidanceCheckins,
      sessions: dataStore.sessions,
      notes: dataStore.notes,
      activities: dataStore.activities,
      sessionTasks: dataStore.sessionTasks,
      pendingTasks: dataStore.pendingTasks,
      scheduledActivities: dataStore.scheduledActivities,
      moodEntries: dataStore.moodEntries,
      dailyShutdowns: dataStore.dailyShutdowns,
      savedLinks: dataStore.savedLinks,
      dailyTasks: dataStore.dailyTasks
    };
    
    const container = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      payload
    };
    
    md += JSON.stringify(container, null, 2);
    md += `\n<!-- DUDE_RESTORE_VAULT_END -->\n`;
    
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dude-backup-${email.split('@')[0]}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    dataStore.showNotification('Identidade exportada como arquivo híbrido .md!', 'success');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      
      const startIndex = text.indexOf('<!-- DUDE_RESTORE_VAULT_START -->');
      const endIndex = text.indexOf('<!-- DUDE_RESTORE_VAULT_END -->');
      
      if (startIndex === -1 || endIndex === -1) {
        dataStore.showNotification('Arquivo inválido! Não foi possível encontrar a assinatura do Data Vault.', 'error');
        return;
      }
      
      const jsonStr = text.substring(startIndex + '<!-- DUDE_RESTORE_VAULT_START -->'.length, endIndex);
      try {
        const parsed = JSON.parse(jsonStr.trim());
        if (!parsed || !parsed.payload) {
          throw new Error('Formato do Payload inválido ou vazio.');
        }
        
        setPendingImportPayload(parsed.payload);
        setShowImportConfirm(true);
      } catch (err: any) {
        console.error('Error parsing backup JSON:', err);
        dataStore.showNotification('Erro ao processar arquivo: ' + err.message, 'error');
      }
    };
    
    reader.readAsText(file);
    e.target.value = '';
  };

  const runImportRestore = async () => {
    if (!user?.id || !pendingImportPayload) return;
    setIsImporting(true);
    try {
      const userId = user.id;
      const p = pendingImportPayload;
      
      const tablesToWipe = [
        'session_tasks',
        'pending_tasks',
        'habit_completions',
        'notes',
        'daily_tasks',
        'scheduled_activities',
        'focus_sessions',
        'activities',
        'habits',
        'projects',
        'avoidance_checkins',
        'mood_entries',
        'daily_shutdowns',
        'saved_links'
      ];
      
      for (const tbl of tablesToWipe) {
        try {
          await supabase.from(tbl).delete().eq('user_id', userId);
        } catch (err) {
          console.warn(`Failure during wiping child table ${tbl} for restore, proceeding:`, err);
        }
      }
      
      const safeInsert = async (table: string, items: any[]) => {
        if (!items || !Array.isArray(items) || items.length === 0) return;
        
        const sanitizedItems = items.map(item => {
          const copy = { ...item };
          if (copy.user_id) copy.user_id = userId;
          return copy;
        });
        
        const chunkSize = 100;
        for (let i = 0; i < sanitizedItems.length; i += chunkSize) {
          const chunk = sanitizedItems.slice(i, i + chunkSize);
          const { error } = await supabase.from(table).insert(chunk);
          if (error) {
            console.error(`Error importing chunk into ${table}:`, error);
            throw error;
          }
        }
      };
      
      if (p.profile) {
        await supabase.from('profiles').update({
          total_focus_minutes: p.profile.total_focus_minutes ?? 0,
          current_streak: p.profile.current_streak ?? 0,
          daily_goal_minutes: p.profile.daily_goal_minutes ?? null
        }).eq('id', userId);
      }
      
      await safeInsert('projects', p.projects);
      await safeInsert('habits', p.habits);
      await safeInsert('activities', p.activities);
      await safeInsert('notes', p.notes);
      await safeInsert('daily_tasks', p.dailyTasks || p.daily_tasks);
      await safeInsert('daily_shutdowns', p.dailyShutdowns || p.daily_shutdowns);
      await safeInsert('saved_links', p.savedLinks || p.saved_links);
      await safeInsert('mood_entries', p.moodEntries || p.mood_entries);
      await safeInsert('avoidance_checkins', p.avoidanceCheckins || p.avoidance_checkins);
      await safeInsert('focus_sessions', p.sessions);
      await safeInsert('session_tasks', p.sessionTasks || p.session_tasks);
      await safeInsert('pending_tasks', p.pendingTasks || p.pending_tasks);
      await safeInsert('scheduled_activities', p.scheduledActivities || p.scheduled_activities);
      await safeInsert('habit_completions', p.habitCompletions || p.habit_completions);
      
      dataStore.showNotification('Identidade transferida e restaurada com sucesso!', 'success');
      
      onClose();
      window.location.reload();
    } catch (err: any) {
      console.error('Critical failure during identity restoration:', err);
      dataStore.showNotification('Erro restaurando backup: ' + err.message, 'error');
    } finally {
      setIsImporting(false);
      setShowImportConfirm(false);
      setPendingImportPayload(null);
    }
  };

  const handleWipeAccount = async () => {
    if (!user?.id) return;
    setIsWiping(true);
    try {
      const ok = await dataStore.wipeUserAccount(user.id);
      if (ok) {
        dataStore.showNotification('Sua conta foi excluída definitivamente.', 'success');
        
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {}

        await supabase.auth.signOut();
        const authSignOut = useAuthStore.getState().signOut;
        if (authSignOut) {
          await authSignOut();
        }
        onClose();
        window.location.href = '/';
      } else {
        dataStore.showNotification('Ocorreu um erro ao excluir sua conta.', 'error');
      }
    } catch (err: any) {
      console.error('Error in account wiping:', err);
      dataStore.showNotification('Erro ao excluir conta: ' + err.message, 'error');
    } finally {
      setIsWiping(false);
      setShowDeleteConfirm(false);
    }
  };

  // Synchronize initially loaded full_name
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  // Reset delete states when panel is closed
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
      setConfirmText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle name update
  const handleSaveName = async () => {
    if (!user?.id || !fullName.trim()) return;
    const firstName = fullName.trim().split(/\s+/)[0];
    setIsSavingName(true);
    try {
      await dataStore.updateProfileData(user.id, { full_name: firstName });
      setFullName(firstName);
      dataStore.showNotification('Nome atualizado com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error updating name:', err);
      dataStore.showNotification('Erro ao salvar nome: ' + err.message, 'error');
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle avatar upload to Supabase Storage
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user?.id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to the 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update backend & store state immediately
      await dataStore.updateProfileData(user.id, { avatar_url: publicUrl });
      dataStore.showNotification('Foto de perfil atualizada com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      dataStore.showNotification('Erro ao carregar imagem: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Trigger input file dialog
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Handle password recovery email
  const handleSendRecoveryEmail = async () => {
    if (!userEmail) return;
    setIsRequestingRecovery(true);
    setPasswordFeedback(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      dataStore.showNotification('E-mail de redefinição enviado com sucesso!', 'success');
      setPasswordFeedback({ message: 'E-mail de redefinição enviado com sucesso!', type: 'success' });
    } catch (err: any) {
      console.error('Error resetting password:', err);
      dataStore.showNotification('Não foi possível enviar o email de redefinição.', 'error');
      setPasswordFeedback({ message: err.message || 'Erro ao encaminhar e-mail.', type: 'error' });
    } finally {
      setIsRequestingRecovery(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-base/80 backdrop-blur-md"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="relative w-full max-w-md h-full bg-surface-1 border-l border-border-custom shadow-2xl flex flex-col z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-border-custom flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-[#6ee7a8]">Conta do Usuário</span>
          <button
            onClick={onClose}
            className="p-2 text-text-dim hover:text-text rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 select-none">
          {/* Avatar Section */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border border-border-custom overflow-hidden bg-surface-2 flex items-center justify-center relative shadow-lg">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Foto do perfil"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(110,231,168,0.15)_0%,transparent_70%)] flex items-center justify-center text-[#6ee7a8] font-bold text-3xl">
                    {fullName?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-base/70 flex items-center justify-center">
                    <span className="text-[10px] text-[#6ee7a8] font-mono animate-pulse">CARREGANDO...</span>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <button
                onClick={triggerFileInput}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-2 bg-[#6ee7a8] text-base rounded-full border border-surface-1 shadow hover:scale-105 active:scale-95 transition-all text-black cursor-pointer"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Input File hidden */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />

            <div>
              <h3 className="text-base font-bold text-text tracking-tight">
                {profile?.full_name || 'Usuário DUDE'}
              </h3>
              <span className="text-[10px] font-mono text-text-dim bg-surface-2 px-3 py-1.5 rounded-full border border-border-custom mt-2.5 inline-block">
                {userEmail || 'email@exemplo.com'}
              </span>
            </div>
          </div>

          <hr className="border-border-custom" />

          {/* Edit Profile Form */}
          <div className="space-y-4">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6ee7a8]">Dados da Conta</label>
            
            {/* Campo Nome */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-text-dim opacity-40 px-1">Seu Primeiro Nome</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim/40"><User size={14} /></span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Gus"
                    className="w-full bg-surface-2 border border-border-custom rounded-2xl pl-11 pr-4 py-3.5 text-xs text-text focus:outline-none focus:border-green/30 transition-all min-h-[44px] touch-manipulation"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={isSavingName || !fullName.trim()}
                  className="px-4 py-3.5 bg-green hover:brightness-105 rounded-2xl text-[10px] font-bold tracking-wider text-base uppercase transition-all disabled:opacity-40 min-h-[44px] touch-manipulation"
                >
                  {isSavingName ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            {/* Campo Email - Read-Only */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-text-dim opacity-40 px-1">Email Cadastrado (Somente Leitura)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim/40"><Mail size={14} /></span>
                <input
                  type="text"
                  value={userEmail || ''}
                  readOnly
                  className="w-full bg-surface-2/40 border border-border-custom/50 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-text-dim select-all focus:outline-none min-h-[44px]"
                />
              </div>
            </div>
          </div>

          <hr className="border-border-custom" />

          {/* Privacidade e Rastreamento */}
          <div className="space-y-4">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6ee7a8]">Privacidade e Rastreamento</label>
            
            <div className="bg-surface-2/40 border border-border-custom rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-1 pr-2">
                <span className="text-xs font-bold text-text block">Radar de Energia e Humor</span>
                <p className="text-[10px] text-text-dim/60 leading-relaxed font-light">
                  Habilita o pop-up diário para registrar seus níveis físicos e mentais. Mantê-lo ativo ajuda a gerar insights precisos.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!user?.id) return;
                  const currentStatus = profile?.mood_status ?? 'active';
                  const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
                  try {
                    await dataStore.updateProfileData(user.id, { mood_status: newStatus });
                    dataStore.showNotification(
                      newStatus === 'active' ? 'Radar de humor ativado!' : 'Radar de humor desativado.', 
                      'success'
                    );
                  } catch (err: any) {
                    dataStore.showNotification('Erro ao atualizar privacidade: ' + err.message, 'error');
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow ${
                  (profile?.mood_status ?? 'active') !== 'disabled' ? 'bg-[#6ee7a8]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface-1 shadow ring-0 transition duration-200 ease-in-out ${
                    (profile?.mood_status ?? 'active') !== 'disabled' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <hr className="border-border-custom" />

          {/* Backup e Transferência */}
          <div className="space-y-4">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6ee7a8]">Backup e Transferência</label>
            
            <p className="text-[10px] text-text-dim/60 leading-relaxed px-1">
              Exporte toda a sua identidade da DUDE (hábitos, foco, logs e notas) em um arquivo MD/JSON híbrido legível por humanos e restabeleça em qualquer dispositivo.
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={exportIdentity}
                className="w-full h-12 border border-[#6ee7a8]/30 hover:border-[#6ee7a8]/60 hover:bg-[#6ee7a8]/5 text-[#6ee7a8] active:scale-98 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer flex items-center justify-center gap-2"
              >
                <Download size={12} />
                💾 Exportar Identidade (Backup)
              </button>

              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                className="w-full h-12 border border-[#6ee7a8]/30 hover:border-[#6ee7a8]/60 hover:bg-[#6ee7a8]/5 text-[#6ee7a8] active:scale-98 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload size={12} />
                📂 Importar Identidade (Restore)
              </button>

              <input
                type="file"
                ref={importFileInputRef}
                onChange={handleImportFile}
                accept=".md"
                className="hidden"
              />
            </div>
          </div>

          <hr className="border-border-custom" />

          {/* Segurança */}
          <div className="space-y-4">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6ee7a8]">Segurança</label>
            
            <p className="text-[10px] text-text-dim/60 leading-relaxed px-1">
              Para sua segurança, caso precise alterar ou recuperar sua senha da DUDE, clique no botão abaixo e nós enviaremos um e-mail com instruções para você definir uma nova credencial com total sigilo.
            </p>

            <button
              onClick={handleSendRecoveryEmail}
              disabled={isRequestingRecovery}
              className="w-full h-12 border border-[#6ee7a8]/30 hover:border-[#6ee7a8]/60 hover:bg-[#6ee7a8]/5 text-[#6ee7a8] active:scale-98 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock size={12} />
              {isRequestingRecovery ? 'ENVIANDO E-MAIL...' : 'REDEFINIR SENHA'}
            </button>

            {passwordFeedback && (
              <p className={`text-[10px] text-center px-1 font-mono uppercase tracking-wider ${passwordFeedback.type === 'success' ? 'text-green' : 'text-coral'}`}>
                {passwordFeedback.message}
              </p>
            )}
          </div>

          <hr className="border-border-custom" />

          {/* Exclusão de Conta */}
          <div className="space-y-4 pt-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#f87171]">Zona de Perigo</label>
            <p className="text-[10px] text-text-dim/60 leading-relaxed px-1">
              Caso deseje apagar todos os seus dados da plataforma DUDE permanentemente, utilize a opção abaixo para excluir sua conta de forma definitiva e irreversível.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full h-12 border border-[#f87171]/20 hover:border-[#f87171]/45 hover:bg-[#f87171]/5 text-[#f87171] active:scale-98 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer flex items-center justify-center gap-2"
            >
              <Trash2 size={12} />
              DELETAR MINHA CONTA
            </button>
          </div>
        </div>

        {/* Footer with discret SignOut Button */}
        <div className="p-6 border-t border-border-custom bg-surface-2/30 flex items-center justify-center">
          <button
            onClick={() => {
              onSignOut();
              onClose();
            }}
            className="flex items-center gap-2.5 px-6 py-3 border border-coral/15 bg-coral/5 hover:bg-coral/10 hover:border-coral/20 text-coral rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer min-h-[40px] shadow"
          >
            <LogOut size={12} />
            Sair
          </button>
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-base/90 backdrop-blur-md p-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-surface-2 border border-border-custom rounded-3xl p-8 text-center space-y-6 shadow-2xl relative"
            >
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#f87171]/10 flex items-center justify-center text-[#f87171] mx-auto mb-2">
                  <Trash2 size={20} />
                </div>
                <h4 className="text-lg font-extrabold text-[#f87171] tracking-tight uppercase">
                  Excluir Conta Definitivamente?
                </h4>
                <p className="text-xs text-text-dim/80 leading-relaxed">
                  Esta ação apagará todo o seu histórico, tarefas, hábitos e sessões profundas. Essa ação é irreversível. Deseja continuar?
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-text-dim/60 font-semibold uppercase tracking-wider text-center">
                  Digite a palavra <span className="text-[#f87171] font-extrabold">DELETAR</span> abaixo para prosseguir:
                </p>
                <input 
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Digite DELETAR para confirmar"
                  className="w-full p-4 rounded-2xl bg-base border border-border-custom text-white text-center font-extrabold uppercase tracking-[0.1em] text-xs focus:outline-none focus:border-[#f87171]/60 transition-all select-all placeholder-text-dim/30"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={isWiping || confirmText.trim().toUpperCase() !== 'DELETAR'}
                  onClick={handleWipeAccount}
                  className={`w-full py-4 text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer shadow-md ${
                    confirmText.trim().toUpperCase() === 'DELETAR'
                      ? 'bg-[#f87171] hover:bg-[#e11d48]'
                      : 'bg-[#f87171]/30 opacity-40 cursor-not-allowed grayscale'
                  }`}
                >
                  {isWiping ? 'DELETANDO TUDO...' : 'SIM, DELETAR TUDO'}
                </button>
                <button
                  type="button"
                  disabled={isWiping}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setConfirmText('');
                  }}
                  className="w-full py-4 border border-border-custom hover:bg-surface-1 text-text-dim rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Confirmation Modal */}
      <AnimatePresence>
        {showImportConfirm && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-base/90 backdrop-blur-md p-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-surface-2 border border-border-custom rounded-3xl p-8 text-center space-y-6 shadow-2xl relative"
            >
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#6ee7a8]/10 flex items-center justify-center text-[#6ee7a8] mx-auto mb-2">
                  <Database size={20} />
                </div>
                <h4 className="text-lg font-extrabold text-[#6ee7a8] tracking-tight uppercase">
                  Substituir Identidade?
                </h4>
                <p className="text-xs text-text-dim/80 leading-relaxed">
                  Atenção: Isso sobrescreverá seus dados atuais definitivamente e iniciará o arquivo transferido. Tem certeza de que deseja prosseguir com a restauração?
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={runImportRestore}
                  className="w-full py-4 text-black bg-[#6ee7a8] hover:bg-[#52c18d] rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer shadow-md"
                >
                  {isImporting ? 'IMPORTANDO DADOS...' : 'SIM, RESTAURAR TUDO'}
                </button>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => {
                    setShowImportConfirm(false);
                    setPendingImportPayload(null);
                  }}
                  className="w-full py-4 border border-border-custom hover:bg-surface-1 text-text-dim rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
