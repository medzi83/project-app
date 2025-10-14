/**
 * Froxlor API Client
 * https://docs.froxlor.org/latest/api-guide/
 */

type FroxlorConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

type FroxlorResponse<T = unknown> = {
  status: number;
  status_message: string;
  data?: T;
};

export type FroxlorCustomer = {
  customerid: number;
  loginname: string;
  customernumber: string;
  firstname: string;
  name: string;
  company: string;
  email: string;
  deactivated: number;
  standardsubdomain?: string;
  diskspace?: string;
  mysqls?: number;
  ftps?: number;
  documentroot?: string;
  allowed_phpconfigs?: string;
  leregistered?: number;
  // Add more fields as needed
};

export type FroxlorPhpConfig = {
  id: number;
  description: string;
  binary: string;
  file_extensions: string;
  mod_fcgid_starter: number;
  mod_fcgid_maxrequests: number;
  phpsettings: string;
};

export type FroxlorDomain = {
  id: string;
  domain: string;
  documentroot: string;
  customerid: string;
  ssl_redirect: string;
  letsencrypt: string;
  phpsettingid: string;
  ssl_enabled: string;
  deactivated?: string;
  // Add more fields as needed
};

type FroxlorListingPayload<T> = { list?: T[] } | T[] | Record<string, T>;

const normalizeFroxlorList = <T>(payload: FroxlorListingPayload<T> | null | undefined): T[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === 'object') {
    const maybeWithList = payload as { list?: T[] };
    if (Array.isArray(maybeWithList.list)) {
      return maybeWithList.list;
    }
    return Object.values(payload as Record<string, T>);
  }
  return [];
};

export type FroxlorCustomerCreateInput = {
  customernumber: string;
  firstname: string;
  name: string;
  company: string;
  email: string;
  loginname: string;
  password: string;
  diskspace: number;
  mysqls: number;
  ftps: number;
  deactivated: number;
  documentroot?: string;
  allowed_phpconfigs?: string;
  leregistered?: number;
};

export type FroxlorCustomerUpdateInput = Partial<Omit<FroxlorCustomerCreateInput, 'password' | 'loginname'>> & {
  password?: string;
  loginname?: string;
};

export class FroxlorClient {
  private config: FroxlorConfig;

  constructor(config: FroxlorConfig) {
    this.config = config;
  }

  /**
   * Make a request to the Froxlor API
   */
  private async request<T = unknown>(
    command: string,
    params: Record<string, unknown> = {}
  ): Promise<FroxlorResponse<T>> {
    const apiUrl = `${this.config.url.replace(/\/$/, '')}/api.php`;

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          header: {
            apikey: this.config.apiKey,
            secret: this.config.apiSecret,
          },
          body: {
            command,
            params,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Froxlor API request timeout (10s)');
        }
        if (error.message.includes('fetch failed')) {
          throw new Error(`Connection to ${apiUrl} failed - check URL and network`);
        }
      }
      throw error;
    }
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Use a simple API call to test the connection
      const result = await this.request('Froxlor.listFunctions');

      if (result.status === 200) {
        return {
          success: true,
          message: 'Verbindung erfolgreich',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Unbekannter Fehler',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Verbindungsfehler',
      };
    }
  }

  /**
   * Search for a customer by customer number
   * Searches in both customernumber field and loginname field
   * Handles variations like "25065" matching "E25065" or "VW33440"
   */
  async findCustomerByNumber(customerNumber: string, debug = false): Promise<FroxlorCustomer | null> {
    try {
      // Get all customers and search in-memory
      const result = await this.request<FroxlorListingPayload<FroxlorCustomer>>('Customers.listing');

      if (result.status === 200 && result.data) {
        const customers = normalizeFroxlorList(result.data);

        const cleanNumber = customerNumber.trim().toUpperCase();
        const numericPart = cleanNumber.replace(/\D/g, '');

        // Search through customers
        const customer = customers.find((c) => {
          const customerNum = (c.customernumber || '').trim().toUpperCase();
          const loginName = (c.loginname || '').trim().toUpperCase();

          // Exact match on customernumber or loginname
          if (customerNum === cleanNumber || loginName === cleanNumber) {
            return true;
          }

          // If input is numeric only (e.g., "25065"), match against loginname with prefix
          if (numericPart && numericPart === cleanNumber) {
            const loginNumeric = loginName.replace(/\D/g, '');
            if (loginNumeric === numericPart) {
              return true;
            }
          }

          // If input has prefix (e.g., "E25065"), match loginname numeric part
          if (numericPart && numericPart !== cleanNumber) {
            const loginNumeric = loginName.replace(/\D/g, '');
            const customerNumeric = customerNum.replace(/\D/g, '');
            if (loginNumeric === numericPart || customerNumeric === numericPart) {
              return true;
            }
          }

          return false;
        });

        if (customer && debug) {
          console.log('=== FROXLOR CUSTOMER DATA ===');
          console.log(JSON.stringify(customer, null, 2));
          console.log('=== END CUSTOMER DATA ===');
        }

        if (customer) {
          return customer;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding customer:', error);
      return null;
    }
  }

  /**
   * Get customer details by ID
   */
  async getCustomer(customerId: number): Promise<FroxlorCustomer | null> {
    try {
      const result = await this.request<FroxlorCustomer>('Customers.get', {
        id: customerId,
      });

      if (result.status === 200 && result.data) {
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('Error getting customer:', error);
      return null;
    }
  }

  /**
   * Create a new customer in Froxlor
   * Note: In Froxlor 0.10.x, the loginname parameter is often ignored during Customers.add
   * and auto-generated (web1, web2, etc.). Once created with subdomains, it cannot be changed.
   *
   * For your use case: Since customernumber can be set and searched, we'll use that as the
   * primary identifier. The loginname will be auto-generated by Froxlor.
   */
  async createCustomer(data: FroxlorCustomerCreateInput): Promise<{ success: boolean; message: string; customer?: FroxlorCustomer }> {
    try {
      // Create customer - Froxlor will auto-generate loginname
      // We use customernumber as the main identifier
      const result = await this.request<FroxlorCustomer>('Customers.add', {
        ...data,
        // Ensure customernumber is set (this is what we'll use for searching)
        customernumber: data.customernumber,
        def_language: 'Deutsch',
        adminid: 1,
      });

      if (result.status === 200 && result.data) {
        const customerId = result.data.customerid;
        const actualLoginname = result.data.loginname;

        return {
          success: true,
          message: `Kunde erfolgreich angelegt (ID: ${customerId}, Login: ${actualLoginname}, Kundennr: ${data.customernumber})`,
          customer: result.data,
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Anlegen des Kunden',
      };
    } catch (error) {
      console.error('Error creating customer:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Anlegen des Kunden',
      };
    }
  }

  /**
   * Update an existing customer
   */
  async updateCustomer(
    customerId: number,
    data: FroxlorCustomerUpdateInput
  ): Promise<{ success: boolean; message: string; customer?: FroxlorCustomer }> {
    try {
      const result = await this.request<FroxlorCustomer>('Customers.update', {
        id: customerId,
        ...data,
      });

      if (result.status === 200 && result.data) {
        return {
          success: true,
          message: 'Kunde erfolgreich aktualisiert',
          customer: result.data,
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Aktualisieren des Kunden',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Kunden',
      };
    }
  }

  /**
   * Get all available PHP configurations from Froxlor
   */
  async getPhpConfigs(): Promise<FroxlorPhpConfig[]> {
    try {
      const result = await this.request<FroxlorListingPayload<FroxlorPhpConfig>>('PhpSettings.listing');

      if (result.status === 200 && result.data) {
        return normalizeFroxlorList(result.data);
      }

      return [];
    } catch (error) {
      console.error('Error getting PHP configs:', error);
      return [];
    }
  }

  /**
   * Get all domains for a customer
   */
  async getCustomerDomains(customerId: number): Promise<FroxlorDomain[]> {
    try {
      const result = await this.request<FroxlorListingPayload<FroxlorDomain>>('Domains.listing', {
        customerid: customerId,
      });

      if (result.status === 200 && result.data) {
        const domains = normalizeFroxlorList(result.data);

        // Filter by customerid (API might return all domains despite parameter)
        return domains.filter((d) => d && d.customerid == customerId);
      }

      return [];
    } catch (error) {
      console.error('Error getting customer domains:', error);
      return [];
    }
  }

  /**
   * Get customer's standard domain (subdomain)
   */
  async getCustomerStandardDomain(customerId: number, standardSubdomainId: number): Promise<FroxlorDomain | null> {
    try {
      const domains = await this.getCustomerDomains(customerId);
      const standardDomain = domains.find((d) => d && parseInt(d.id) === standardSubdomainId);
      return standardDomain || null;
    } catch (error) {
      console.error('Error getting customer standard domain:', error);
      return null;
    }
  }

  /**
   * Update a domain's settings
   */
  async updateDomain(
    domainId: number,
    data: Partial<{
      documentroot: string;
      ssl_redirect: number;
      letsencrypt: number;
      phpsettingid: number;
    }>
  ): Promise<{ success: boolean; message: string; domain?: FroxlorDomain }> {
    try {
      const result = await this.request<FroxlorDomain>('Domains.update', {
        id: domainId,
        ...data,
      });

      if (result.status === 200 && result.data) {
        return {
          success: true,
          message: 'Domain erfolgreich aktualisiert',
          domain: result.data,
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Aktualisieren der Domain',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Domain',
      };
    }
  }
}
