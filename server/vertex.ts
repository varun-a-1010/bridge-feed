import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';

export type Generate = (request: GenerateContentParameters) => Promise<GenerateContentResponse>;
export type VertexAccount = { project?: string; serviceAccount?: string };

const statusOf = (error: unknown) => (error as { status?: number }).status ?? 'unknown';

/**
 * Each project has its own quota, so a failed call tries the same model on the backup before the
 * model chain moves on. A call that already timed out has no time left to try again.
 */
export const withBackup =
  (primary: Generate, backup: Generate): Generate =>
  async (request) => {
    try {
      return await primary(request);
    } catch (error) {
      if (request.config?.abortSignal?.aborted) throw error;
      console.warn('Primary Vertex project failed, trying the backup.', statusOf(error));
      return backup(request);
    }
  };

function connect(account: VertexAccount, location?: string): Generate | undefined {
  if (!account.project || !account.serviceAccount) return undefined;
  const raw = account.serviceAccount.trim();
  const client = new GoogleGenAI({
    vertexai: true,
    project: account.project,
    location: location || 'global',
    googleAuthOptions: {
      credentials: JSON.parse(
        raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'),
      ),
    },
  });
  return (request) => client.models.generateContent(request);
}

export function createGenerate(
  options: VertexAccount & { location?: string; backup?: VertexAccount },
): Generate | undefined {
  const primary = connect(options, options.location);
  if (!primary || !options.backup) return primary;
  try {
    const backup = connect(options.backup, options.location);
    return backup ? withBackup(primary, backup) : primary;
  } catch {
    console.warn('The backup Vertex credential could not be read, so it is not in use.');
    return primary;
  }
}
