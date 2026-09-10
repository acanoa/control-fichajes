export const TERMINAL_TOKEN_KEY = 'cf_device_token';

interface TerminalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const storageError = () => new Error(
  'No se puede guardar la identificación del dispositivo. Permite el almacenamiento del sitio y utiliza una ventana normal del navegador.',
);

export function checkTerminalStorage(storage: TerminalStorage): void {
  const probeKey = 'cf_device_storage_check';
  try {
    storage.setItem(probeKey, '1');
    if (storage.getItem(probeKey) !== '1') throw storageError();
    storage.removeItem(probeKey);
  } catch {
    throw storageError();
  }
}

export function saveTerminalToken(storage: TerminalStorage, token: string): void {
  try {
    storage.setItem(TERMINAL_TOKEN_KEY, token);
    if (storage.getItem(TERMINAL_TOKEN_KEY) !== token) throw storageError();
  } catch {
    throw storageError();
  }
}

export async function validateStoredTerminal<T>(
  storage: Pick<TerminalStorage, 'getItem'>,
  validate: (token: string) => Promise<{ data: T | null; error: unknown }>,
): Promise<T | null> {
  let token: string | null;
  try {
    token = storage.getItem(TERMINAL_TOKEN_KEY);
  } catch {
    throw storageError();
  }
  if (!token) return null;
  try {
    const { data, error } = await validate(token);
    if (error) throw error;
    // A blocked device or inactive centre may become valid again later.
    // Neither a null result nor a network error revokes the local identity.
    return data;
  } catch {
    throw new Error('No se pudo comprobar la autorización. Revisa la conexión; la identificación del dispositivo se conserva y se volverá a comprobar automáticamente.');
  }
}
