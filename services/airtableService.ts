// Fix: Changed AirtableSettings to AppSettings as it is the correct type exported from ../types.
import { FscRecord, AppSettings } from '../types';

interface AirtableRecord {
  id: string;
  fields: Omit<FscRecord, 'id'>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

// Fix: Changed parameter type from AirtableSettings to AppSettings.
export const fetchFscRecords = async (settings: AppSettings): Promise<FscRecord[]> => {
  if (!settings.apiKey || !settings.baseId || !settings.tableName) {
    throw new Error("Airtable settings are incomplete. Please provide API Key, Base ID, and Table Name.");
  }

  let allRecords: FscRecord[] = [];
  let offset: string | undefined = undefined;
  const filterFormula = "({FSC Status} = 'FSC - Claimed')";

  const baseUrl = `https://api.airtable.com/v0/${settings.baseId}/${encodeURIComponent(settings.tableName)}`;

  try {
    do {
      const url = new URL(baseUrl);
      url.searchParams.append('filterByFormula', filterFormula);
      if (offset) {
        url.searchParams.append('offset', offset);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`Airtable API Error: ${errorMessage}`);
      }

      const data: AirtableResponse = await response.json();
      const records = data.records.map(record => ({
        id: record.id,
        ...record.fields,
        Created: record.createdTime,
      }));
      allRecords = allRecords.concat(records);
      offset = data.offset;
    } while (offset);

    return allRecords;
  } catch (error) {
    console.error("Failed to fetch from Airtable:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to fetch from Airtable: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching from Airtable.");
  }
};