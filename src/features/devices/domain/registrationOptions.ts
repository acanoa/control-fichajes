export interface RegistrationCompany {
  id: string;
  commercial_name: string;
}

export interface RegistrationWorkCenter {
  id: string;
  company_id: string;
  name: string;
}

// PostgreSQL already filters inactive companies and centres in the public RPC.
export interface DeviceRegistrationOptions {
  companies: RegistrationCompany[];
  workCenters: RegistrationWorkCenter[];
}
