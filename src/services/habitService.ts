import { supabase } from '../lib/supabase';

export type HabitType = 'atomic' | 'avoidance';

export const habitService = {
  /**
   * Retorna os hábitos baseados no tipo.
   */
  async getHabitsByType(type: HabitType, userId: string) {
    if (type === 'avoidance') {
      return supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .eq('habit_mode', 'avoid')
        .order('created_at', { ascending: false });
    } else {
      return supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .or('habit_mode.eq.build,habit_mode.is.null')
        .order('created_at', { ascending: false });
    }
  },

  /**
   * Cria um novo hábito.
   */
  async createHabit(data: any, type: HabitType = 'atomic') {
    return supabase
      .from('habits')
      .insert(data)
      .select()
      .single();
  },

  /**
   * Atualiza um hábito.
   */
  async updateHabit(id: string, updates: any, type: HabitType = 'atomic') {
    return supabase
      .from('habits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  },

  /**
   * Deleta um hábito.
   */
  async deleteHabit(id: string, type: HabitType = 'atomic') {
    return supabase
      .from('habits')
      .delete()
      .eq('id', id);
  }
};
