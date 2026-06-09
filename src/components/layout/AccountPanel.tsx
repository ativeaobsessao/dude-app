import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { X, Camera, User, Mail, Lock, LogOut, Check, Trash2 } from 'lucide-react';

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

  const handleWipeAccount = async () => {
    if (!user?.id) return;
    setIsWiping(true);
    try {
      const ok = await dataStore.wipeUserAccount(user.id);
      if (ok) {
        dataStore.showNotification('Sua conta foi excluída definitivamente.', 'success');
        
        // Securely double-wipe client storages
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
        // Hard refresh to initial route to clear the entire React app from RAM and state
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
                  disabled={isWiping || confirmText !== 'DELETAR'}
                  onClick={handleWipeAccount}
                  className={`w-full py-4 text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all min-h-[44px] touch-manipulation cursor-pointer shadow-md ${
                    confirmText === 'DELETAR'
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
    </div>
  );
};
