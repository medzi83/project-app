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
      const result = await this.request('/api/health');

      if (result.success) {
        return {
          success: true,
          message: 'Verbindung erfolgreich',
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
      const result = await this.request<OrgamaxCustomer[]>('/api/customers', {
        params: { mandant },
      });

      if (result.success && result.data) {
        return {
          success: true,
          customers: result.data,
        };
      }

      return {
        success: false,
        error: result.error || 'Fehler beim Abrufen der Kunden',
      };
    } catch (error) {
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
