/**
 * Orgamax ERP ODBC API Client
 * Connects to the Windows Server ODBC API for Orgamax ERP
 */

type OrgamaxConfig = {
  apiUrl: string;
  apiKey: string;
};

/**
 * Orgamax Customer data structure from V_SUCHE_ADRESSFELDER view
 */
export type OrgamaxCustomer = {
  ID: number;
  CONTACTID: number;
  CONTACTTYPE: number;
  SUCHNAME: string | null;
  CUSTNO: number;
  KUNDENNAME: string | null;
  NAMENSZUSATZ: string | null;
  ADDRESS: string | null;
  TITLE: string | null;
  VORNAME: string | null;
  NACHNAME: string | null;
  STREET: string | null;
  COUNTRY: string | null;
  ZIPCODE: string | null;
  CITY: string | null;
  EMAIL: string | null;
  PHONE1: string | null;
  PHONE2: string | null;
  FAX: string | null;
  MOBILE: string | null;
};

/**
 * API Response wrapper
 */
type OrgamaxResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * Query parameters for SQL queries
 */
export type OrgamaxQueryParams = {
  sql: string;
  mandant: number;
};

/**
 * Available Mandanten (clients) in the Orgamax system
 */
export const ORGAMAX_MANDANTEN = [1, 2, 4] as const;
export type OrgamaxMandant = typeof ORGAMAX_MANDANTEN[number];

export class OrgamaxClient {
  private config: OrgamaxConfig;

  constructor(config: OrgamaxConfig) {
    this.config = config;
  }

  /**
   * Make a request to the Orgamax ODBC API
   */
  private async request<T = unknown>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST';
      body?: unknown;
      params?: Record<string, string | number>;
    } = {}
  ): Promise<OrgamaxResponse<T>> {
    const { method = 'GET', body, params } = options;

    // Build URL with query parameters
    const url = new URL(`${this.config.apiUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const jsonResponse = await response.json();

      if (!response.ok) {
        throw new Error(jsonResponse?.error || jsonResponse?.message || `HTTP ${response.status}`);
      }

      return jsonResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Orgamax API request timeout (15s)',
          };
        }
        if (error.message.includes('fetch failed')) {
          return {
            success: false,
            error: `Connection to ${url.toString()} failed - check URL and network`,
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: 'Unknown error occurred',
      };
    }
  }

  /**
   * Test the API connection (health check)
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[OrgamaxClient] testConnection: Starting request to /api/health');
      const result = await this.request<{ status?: string; service?: string; mandanten?: number[] }>('/api/health');

      console.log('[OrgamaxClient] testConnection: Result received:', JSON.stringify(result, null, 2));

      // Check if we have an error response from our wrapper
      if (result.success === false) {
        return {
          success: false,
          message: result.error || 'Verbindungsfehler',
        };
      }

      // Check if we have the expected Orgamax API response
      if (result.data?.status === 'OK' || (result as any).status === 'OK') {
        return {
          success: true,
          message: 'Verbindung erfolgreich',
        };
      }

      return {
        success: false,
        message: `Unerwartete API-Antwort: ${JSON.stringify(result)}`,
      };
    } catch (error) {
      console.error('[OrgamaxClient] testConnection: Exception caught:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Verbindungsfehler',
      };
    }
  }

  /**
   * Test connection for a specific Mandant
   */
  async testMandantConnection(mandant: OrgamaxMandant): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.request('/api/test-connection', {
        params: { mandant },
      });

      if (result.success) {
        return {
          success: true,
          message: `Verbindung zu Mandant ${mandant} erfolgreich`,
        };
      }

      return {
        success: false,
        message: result.error || 'Unbekannter Fehler',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Verbindungsfehler',
      };
    }
  }

  /**
   * Test all available Mandanten
   */
  async testAllMandanten(): Promise<{
    success: boolean;
    message: string;
    results?: Array<{ mandant: number; success: boolean; message: string }>;
  }> {
    try {
      const result = await this.request<Array<{ mandant: number; success: boolean; message: string }>>(
        '/api/test-all-mandanten'
      );

      if (result.success && result.data) {
        return {
          success: true,
          message: 'Alle Mandanten getestet',
          results: result.data,
        };
      }

      return {
        success: false,
        message: result.error || 'Unbekannter Fehler',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Verbindungsfehler',
      };
    }
  }

  /**
   * Get all customers from a specific Mandant
   */
  async getCustomers(mandant: OrgamaxMandant): Promise<{
    success: boolean;
    customers?: OrgamaxCustomer[];
    error?: string;
  }> {
    try {
      console.log('[OrgamaxClient] getCustomers: Starting request to /api/customers with mandant', mandant);
      const result = await this.request<OrgamaxCustomer[]>('/api/customers', {
        params: { mandant },
      });

      console.log('[OrgamaxClient] getCustomers: Result received:', JSON.stringify(result, null, 2));

      // Check if we have an error response from our wrapper
      if (result.success === false) {
        return {
          success: false,
          error: result.error || 'Fehler beim Abrufen der Kunden',
        };
      }

      // Check if we have the expected wrapped response with data
      if (result.success && result.data) {
        return {
          success: true,
          customers: result.data,
        };
      }

      // Check if the response is directly an array of customers (Orgamax API format)
      if (Array.isArray(result)) {
        return {
          success: true,
          customers: result as unknown as OrgamaxCustomer[],
        };
      }

      // Check if we have a data property that is an array
      if ((result as any).data && Array.isArray((result as any).data)) {
        return {
          success: true,
          customers: (result as any).data,
        };
      }

      return {
        success: false,
        error: `Unerwartete API-Antwort: ${JSON.stringify(result)}`,
      };
    } catch (error) {
      console.error('[OrgamaxClient] getCustomers: Exception caught:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler beim Abrufen der Kunden',
      };
    }
  }

  /**
   * Get a single customer by customer number
   */
  async getCustomer(custno: number, mandant: OrgamaxMandant): Promise<{
    success: boolean;
    customer?: OrgamaxCustomer;
    error?: string;
  }> {
    try {
      const result = await this.request<OrgamaxCustomer>(`/api/customers/${custno}`, {
        params: { mandant },
      });

      if (result.success && result.data) {
        return {
          success: true,
          customer: result.data,
        };
      }

      return {
        success: false,
        error: result.error || 'Kunde nicht gefunden',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler beim Abrufen des Kunden',
      };
    }
  }

  /**
   * Execute a free SQL query
   */
  async query<T = unknown>(sql: string, mandant: OrgamaxMandant): Promise<{
    success: boolean;
    data?: T;
    error?: string;
  }> {
    try {
      const result = await this.request<T>('/api/query', {
        method: 'POST',
        body: { sql, mandant },
      });

      if (result.success) {
        return {
          success: true,
          data: result.data,
        };
      }

      return {
        success: false,
        error: result.error || 'Fehler beim Ausführen der Abfrage',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler beim Ausführen der Abfrage',
      };
    }
  }
}

/**
 * Create an Orgamax client from environment variables
 * Returns null if environment variables are not set
 */
export function createOrgamaxClient(): OrgamaxClient | null {
  const apiUrl = process.env.ORGAMAX_API_URL;
  const apiKey = process.env.ORGAMAX_API_KEY;

  if (!apiUrl || !apiKey) {
    console.warn('Orgamax API configuration missing');
    return null;
  }

  return new OrgamaxClient({
    apiUrl,
    apiKey,
  });
}

/**
 * Fix encoding issues with German umlauts and special characters
 * The data is ISO-8859-1/Windows-1252 encoded but contains the replacement character �
 * This means bytes were lost/corrupted. We need a different approach.
 */
export function fixEncoding(text: string | null | undefined): string | null {
  if (!text) return text || null;

  // If there's no replacement character, the text is probably fine
  if (!text.includes('�')) return text;

  // Simple replacement mapping for common corrupted characters
  // Since we're getting � for umlauts, we need context or user feedback
  // For now, let's not modify anything and just return as-is
  // The real fix needs to be on the ODBC side
  return text;
}

/**
 * Normalize phone numbers by replacing special dashes and multiple spaces with regular hyphens
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return phone || null;

  // Replace various dash types and multiple spaces with regular hyphen
  return phone
    .replace(/–/g, '-')        // En dash (U+2013)
    .replace(/—/g, '-')        // Em dash (U+2014)
    .replace(/‐/g, '-')        // Hyphen (U+2010)
    .replace(/‑/g, '-')        // Non-breaking hyphen (U+2011)
    .replace(/\u0096/g, '-')   // Windows-1252 control character (0x96) misinterpreted as UTF-8
    .replace(/\s{2,}/g, ' -'); // Two or more spaces → space + hyphen
}

/**
 * Fix encoding for a complete customer object
 * Applies both encoding fixes for umlauts and phone number normalization
 */
export function fixCustomerEncoding(customer: OrgamaxCustomer): OrgamaxCustomer {
  return {
    ...customer,
    // Fix encoding for text fields
    KUNDENNAME: fixEncoding(customer.KUNDENNAME),
    VORNAME: fixEncoding(customer.VORNAME),
    NACHNAME: fixEncoding(customer.NACHNAME),
    NAMENSZUSATZ: fixEncoding(customer.NAMENSZUSATZ),
    STREET: fixEncoding(customer.STREET),
    CITY: fixEncoding(customer.CITY),
    EMAIL: fixEncoding(customer.EMAIL),
    // Normalize phone numbers (replace special dashes)
    PHONE1: normalizePhoneNumber(customer.PHONE1),
    PHONE2: normalizePhoneNumber(customer.PHONE2),
    FAX: normalizePhoneNumber(customer.FAX),
    MOBILE: normalizePhoneNumber(customer.MOBILE),
  };
}

/**
 * Fix encoding for any data object with string fields
 * Applies encoding fixes and phone number normalization to all string fields
 */
export function fixDataEncoding<T extends Record<string, any>>(data: T): T {
  const fixed = { ...data };

  for (const key in fixed) {
    const value = fixed[key];

    // Apply fixEncoding to all string fields
    if (typeof value === 'string') {
      // Check if it's a phone/fax field
      if (key.includes('PHONE') || key.includes('FAX') || key.includes('MOBILE')) {
        fixed[key] = normalizePhoneNumber(value) as any;
      } else {
        // Apply encoding fix to all other string fields
        fixed[key] = fixEncoding(value) as any;
      }
    }
  }

  return fixed;
}

/**
 * Utility function to format customer address
 */
export function formatCustomerAddress(customer: OrgamaxCustomer): string {
  const parts: string[] = [];

  if (customer.STREET) parts.push(customer.STREET);
  if (customer.ZIPCODE || customer.CITY) {
    const cityLine = [customer.ZIPCODE, customer.CITY].filter(Boolean).join(' ');
    parts.push(cityLine);
  }
  if (customer.COUNTRY && customer.COUNTRY !== 'D') {
    parts.push(customer.COUNTRY);
  }

  return parts.join(', ');
}

/**
 * Utility function to format customer name
 */
export function formatCustomerName(customer: OrgamaxCustomer): string {
  if (customer.KUNDENNAME) {
    return customer.KUNDENNAME;
  }

  const parts: string[] = [];
  if (customer.TITLE) parts.push(customer.TITLE);
  if (customer.VORNAME) parts.push(customer.VORNAME);
  if (customer.NACHNAME) parts.push(customer.NACHNAME);

  return parts.join(' ') || 'Unbekannter Kunde';
}

/**
 * Utility function to get primary contact info
 */
export function getCustomerContact(customer: OrgamaxCustomer): {
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
} {
  return {
    email: customer.EMAIL || undefined,
    phone: customer.PHONE1 || undefined,
    mobile: customer.MOBILE || undefined,
    fax: customer.FAX || undefined,
  };
}
