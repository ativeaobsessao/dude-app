import { supabase } from '../lib/supabase';

export type HabitType = 'atomic' | 'avoidance';

export const habitService = {
  /**
   * Retorna os hábitos baseados no tipo.
   */
  async getHabitsByType(type: HabitType, userId: string) {
    const table = type === 'avoidance' ? 'avoidance_habits' : 'habits';
    return supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  },

  /**
   * Cria um novo hábito na tabela correta.
   */
  async createHabit(data: any, type: HabitType = 'atomic') {
    const table = type === 'avoidance' ? 'avoidance_habits' : 'habits';
    return supabase
      .from(table)
      .insert(data)
      .select()
      .single();
  },

  /**
   * Atualiza um hábito na tabela correta.
   */
  async updateHabit(id: string, updates: any, type: HabitType = 'atomic') {
    const table = type === 'avoidance' ? 'avoidance_habits' : 'habits';
    return supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  },

  /**
   * Deleta um hábito da tabela correta.
   */
  async deleteHabit(id: string, type: HabitType = 'atomic') {
    const table = type === 'avoidance' ? 'avoidance_habits' : 'habits';
    return supabase
      .from(table)
      .delete()
      .eq('id', id);
  }
};
