export const USAGE_BACKUP_FORMAT: string;
export const USAGE_BACKUP_VERSION: number;
export const USAGE_BACKUP_KDF_ITERATIONS: number;
export function createEncryptedUsageBackup(passphrase: string, storage?: Storage | null, cryptoApi?: Crypto): Promise<string>;
export function restoreEncryptedUsageBackup(serialized: string, passphrase: string, storage?: Storage | null, cryptoApi?: Crypto): Promise<{ importedEvents: number; importedRates: number; budgetRestored: boolean }>;
