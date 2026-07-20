begin;

create or replace function "Gestion_Fichajes".approve_device_registration(
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  target_device "Gestion_Fichajes".authorized_devices;
  requester_profile "Gestion_Fichajes".profiles;
begin
  select p.* into requester_profile
  from "Gestion_Fichajes".profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
    and p.role in ('company_admin', 'superadmin')
  limit 1;

  if requester_profile.id is null then
    raise exception 'No tiene permisos para aprobar dispositivos';
  end if;

  select d.* into target_device
  from "Gestion_Fichajes".authorized_devices d
  where d.id = p_device_id
  for update;

  if not found then
    raise exception 'Dispositivo no encontrado';
  end if;

  if requester_profile.role = 'company_admin' and requester_profile.company_id is distinct from target_device.company_id then
    raise exception 'No puede aprobar dispositivos de otra empresa';
  end if;

  if target_device.status = 'active' and target_device.camera_validation_status = 'validated' then
    return to_jsonb(target_device) - 'device_token_digest';
  end if;

  update "Gestion_Fichajes".authorized_devices
  set status = 'active',
      camera_validation_status = 'validated',
      camera_validated_at = now(),
      camera_validated_by = requester_profile.id,
      camera_validation_error = null,
      updated_at = now()
  where id = p_device_id
  returning * into target_device;

  return to_jsonb(target_device) - 'device_token_digest';
end;
$$;

revoke all on function "Gestion_Fichajes".approve_device_registration(uuid) from public;
grant execute on function "Gestion_Fichajes".approve_device_registration(uuid) to authenticated;

commit;
