import { AppError } from '../lib/errors';
import { supabase } from '../integrations/supabase/client';

export async function deleteDayType(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_day_type_settings').delete().eq('id', id);
  if (error) throw new AppError('No se pudo eliminar el tipo de día.', 'DAY_TYPE_DELETE_FAILED', error);
}
