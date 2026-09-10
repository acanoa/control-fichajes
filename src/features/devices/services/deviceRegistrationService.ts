import type { DeviceRegistrationOptions } from '../domain/registrationOptions';
import { AppError } from '../../../lib/errors';
import { supabase } from '../../../integrations/supabase/client';

export async function listDeviceRegistrationOptions(): Promise<DeviceRegistrationOptions> {
  const { data, error } = await supabase.rpc('list_device_registration_options');
  if (error || !data) {
    throw new AppError(
      error?.message || 'No se pudieron cargar las opciones de registro.',
      'DEVICE_OPTIONS_FAILED',
      error,
    );
  }
  return {
    companies: data.companies ?? [],
    workCenters: data.work_centers ?? [],
  };
}
