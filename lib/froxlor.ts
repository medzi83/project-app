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
  customerid: string | number;
  ssl_redirect: string;
  letsencrypt: string;
  phpsettingid: string;
  ssl_enabled: string;
  deactivated?: string;
  loginname?: string;
  // Add more fields as needed
};

export type FroxlorDomainCreateInput = {
  customerid: number;
  domain: string;
  loginname?: string;
  documentroot?: string;
  ssl_redirect?: number;
  letsencrypt?: number;
  phpsettingid?: number;
  isemaildomain?: number;
};

export type FroxlorDatabase = {
  id: number;
  databasename: string;
  description: string;
  dbserver: number;
  customerid: number;
};

export type FroxlorFtpAccount = {
  id: number;
  customerid: number;
  username: string;
  password: string;
  homedir: string;
  login_enabled: string;
  uid: number;
  gid: number;
  last_login: string | null;
  up_count: number;
  down_count: number;
  up_bytes: number;
  down_bytes: number;
  description: string;
};

type FroxlorListingPayload<T> = { list?: T[] } | T[] | Record<string, T>;

const normalizeFroxlorList = <T>(payload: FroxlorListingPayload<T> | null | undefined): T[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === "object") {
    const maybeWithList = payload as { list?: T[] };
    if (Array.isArray(maybeWithList.list)) {
      return maybeWithList.list;
    }
    return Object.values(payload as Record<string, T>);
  }
  return [];
};

const toNumericId = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
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
  diskspace_used?: number;
  mysqls: number;
  ftps: number;
  emails?: number;
  email_accounts?: number;
  email_forwarders?: number;
  email_quota?: number;
  subdomains?: number;
  deactivated: number;
  documentroot?: string;
  allowed_phpconfigs?: string;
  phpenabled?: number;
  perlenabled?: number;
  dnsenabled?: number;
  logviewenabled?: number;
  leregistered?: number;
};

export type FroxlorCustomerUpdateInput = Partial<Omit<FroxlorCustomerCreateInput, 'password' | 'loginname' | 'allowed_phpconfigs'>> & {
  password?: string;
  loginname?: string;
  phpsettings?: string; // Use phpsettings for update instead of allowed_phpconfigs
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

      const jsonResponse = await response.json();

      if (!response.ok) {
        // Try to extract the actual error message from Froxlor's response
        const errorMsg = jsonResponse?.status_message || jsonResponse?.message || response.statusText;
        throw new Error(`HTTP ${response.status}: ${errorMsg}`);
      }

      return jsonResponse;
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
   * IMPORTANT: The loginname can only be set when creating the customer WITH create_stdsubdomain=1
   * This creates both the customer and their standard subdomain with the desired loginname.
   *
   * @param data - Customer data
   * @param standardSubdomain - Domain for standard subdomain (e.g., "vautron06.server-nord.de")
   */
  async createCustomer(data: FroxlorCustomerCreateInput, standardSubdomain?: string): Promise<{ success: boolean; message: string; customer?: FroxlorCustomer }> {
    try {
      // Build the API parameters
      const apiParams: Record<string, unknown> = {
        new_loginname: data.loginname,  // This is the key parameter for loginname!
        customernumber: data.customernumber,
        firstname: data.firstname,
        name: data.name,
        company: data.company,
        email: data.email,
        new_customer_password: data.password,
        def_language: 'Deutsch',
        gender: 0, // 0 = no salutation
        adminid: 1,
        // Resource limits
        diskspace: data.diskspace,
        diskspace_ul: 0, // 0 = use the value from diskspace
        traffic: -1, // -1 = unlimited
        traffic_ul: 1,
        subdomains: data.subdomains ?? -1,
        subdomains_ul: data.subdomains !== undefined ? 0 : 1,
        emails: data.emails ?? -1,
        emails_ul: data.emails !== undefined ? 0 : 1,
        email_accounts: data.email_accounts ?? -1,
        email_accounts_ul: data.email_accounts !== undefined ? 0 : 1,
        email_forwarders: data.email_forwarders ?? -1,
        email_forwarders_ul: data.email_forwarders !== undefined ? 0 : 1,
        email_quota: data.email_quota ?? -1,
        email_quota_ul: data.email_quota !== undefined ? 0 : 1,
        ftps: data.ftps,
        ftps_ul: 0,
        mysqls: data.mysqls,
        mysqls_ul: 0,
        // Features
        phpenabled: data.phpenabled ?? 1,
        perlenabled: data.perlenabled ?? 0,
        dnsenabled: data.dnsenabled ?? 0,
        logviewenabled: data.logviewenabled ?? 1,
        // Status
        deactivated: data.deactivated,
        // Let's Encrypt
        letsencrypt: data.leregistered ?? 0,
      };

      // Add allowed PHP configs if provided
      // Froxlor expects this as a JSON array string like "[1,10]"
      if (data.allowed_phpconfigs) {
        apiParams.phpsettings = data.allowed_phpconfigs; // Use 'phpsettings' instead of 'allowed_phpconfigs'
      }

      // Add documentroot if provided
      if (data.documentroot) {
        apiParams.documentroot = data.documentroot;
      }

      // IMPORTANT: Create with standard subdomain using create_stdsubdomain=1
      // This is what actually sets the loginname!
      if (standardSubdomain) {
        apiParams.createstdsubdomain_as_email = standardSubdomain;
      }

      const result = await this.request<FroxlorCustomer>('Customers.add', apiParams);

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
   * Get FTP accounts for a customer
   */
  async getCustomerFtpAccounts(customerId: number): Promise<FroxlorFtpAccount[]> {
    try {
      const result = await this.request<FroxlorListingPayload<FroxlorFtpAccount>>('Ftps.listing', {
        customerid: customerId,
      });

      if (result.status === 200 && result.data) {
        return normalizeFroxlorList(result.data);
      }

      return [];
    } catch (error) {
      console.error('Error fetching FTP accounts:', error);
      return [];
    }
  }

  /**
   * Get all domains for a customer
   */
  async getCustomerDomains(customerId: number | string): Promise<FroxlorDomain[]> {
    const targetId = toNumericId(customerId);

    try {
      const result = await this.request<FroxlorListingPayload<FroxlorDomain>>("Domains.listing", {
        customerid: targetId ?? customerId,
      });

      if (result.status === 200 && result.data) {
        const domains = normalizeFroxlorList(result.data);

        if (targetId == null) {
          return domains;
        }

        // Filter by customerid (API might return all domains despite parameter)
        return domains.filter((domain) => toNumericId(domain?.customerid) === targetId);
      }

      return [];
    } catch (error) {
      console.error("Error getting customer domains:", error);
      return [];
    }
  }

  /**
   * Get customer's standard domain (subdomain)
   */
  async getCustomerStandardDomain(
    customerId: number | string,
    standardSubdomainId: number | string
  ): Promise<FroxlorDomain | null> {
    try {
      const targetStandardId = toNumericId(standardSubdomainId);
      const domains = await this.getCustomerDomains(customerId);
      const standardDomain = domains.find((domain) => {
        if (targetStandardId == null) return false;
        return toNumericId(domain?.id) === targetStandardId;
      });
      return standardDomain || null;
    } catch (error) {
      console.error("Error getting customer standard domain:", error);
      return null;
    }
  }

  /**
   * Create a new domain
   * IMPORTANT: The loginname parameter here is what actually sets the customer's loginname!
   */
  async createDomain(data: FroxlorDomainCreateInput): Promise<{ success: boolean; message: string; domain?: FroxlorDomain }> {
    try {
      const result = await this.request<FroxlorDomain>('Domains.add', {
        ...data,
      });

      if (result.status === 200 && result.data) {
        return {
          success: true,
          message: 'Domain erfolgreich angelegt',
          domain: result.data,
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Anlegen der Domain',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Anlegen der Domain',
      };
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
      phpenabled: number;
      openbasedir: number;
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

  /**
   * Get all databases for a customer
   */
  async getCustomerDatabases(customerId: number): Promise<FroxlorDatabase[]> {
    try {
      const result = await this.request<FroxlorListingPayload<FroxlorDatabase>>('Mysqls.listing', {
        customerid: customerId,
      });

      if (result.status === 200 && result.data) {
        return normalizeFroxlorList(result.data);
      }

      return [];
    } catch (error) {
      console.error('Error getting customer databases:', error);
      return [];
    }
  }

  /**
   * Create a new MySQL database for a customer
   * Froxlor automatically names databases as [loginname]sql1, [loginname]sql2, etc.
   */
  async createDatabase(
    customerId: number,
    password: string,
    description?: string
  ): Promise<{ success: boolean; message: string; database?: FroxlorDatabase; databaseName?: string }> {
    try {
      const result = await this.request<FroxlorDatabase>('Mysqls.add', {
        customerid: customerId,
        mysql_password: password,
        description: description || 'Joomla Database',
        sendinfomail: 0, // Don't send email
      });

      if (result.status === 200 && result.data) {
        return {
          success: true,
          message: 'Datenbank erfolgreich angelegt',
          database: result.data,
          databaseName: result.data.databasename,
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Anlegen der Datenbank',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Anlegen der Datenbank',
      };
    }
  }

  /**
   * Delete a MySQL database by name
   * Uses the proven method: Find database by name, then delete by ID + customerid
   * @param databaseName - The name of the database to delete
   */
  async deleteDatabase(databaseName: string): Promise<{ success: boolean; message: string }> {
    try {
      // Primary method: List databases, find by name, delete with ID + customerid
      // This is the proven method that works with Froxlor
      const listResult = await this.request<FroxlorListingPayload<FroxlorDatabase>>('Mysqls.listing');

      if (listResult.status !== 200 || !listResult.data) {
        return {
          success: false,
          message: 'Fehler beim Abrufen der Datenbankliste',
        };
      }

      const databases = normalizeFroxlorList(listResult.data);
      const database = databases.find(db => db.databasename === databaseName);

      if (!database) {
        return {
          success: false,
          message: `Datenbank ${databaseName} nicht gefunden`,
        };
      }

      // Delete with ID + customerid (this is the working method)
      const result = await this.request('Mysqls.delete', {
        id: database.id,
        customerid: database.customerid,
      });

      if (result.status === 200) {
        return {
          success: true,
          message: `Datenbank ${databaseName} erfolgreich gelöscht`,
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Löschen der Datenbank',
      };
    } catch (error) {
      console.error('Error deleting database:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Löschen der Datenbank',
      };
    }
  }
}
