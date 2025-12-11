/**
 * Froxlor API Client
 * https://docs.froxlor.org/latest/api-guide/
 */

type FroxlorConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
  version?: string; // "1.x" or "2.0+" (default: "2.0+")
};

/**
 * Helper type for server objects with Froxlor credentials
 */
type ServerWithFroxlor = {
  froxlorUrl: string | null;
  froxlorApiKey: string | null;
  froxlorApiSecret: string | null;
  froxlorVersion?: string | null;
};

/**
 * Create a Froxlor client from a server object
 * Returns null if server doesn't have complete Froxlor configuration
 */
export function createFroxlorClientFromServer(server: ServerWithFroxlor): FroxlorClient | null {
  if (!server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
    return null;
  }

  return new FroxlorClient({
    url: server.froxlorUrl,
    apiKey: server.froxlorApiKey,
    apiSecret: server.froxlorApiSecret,
    version: server.froxlorVersion || undefined,
  });
}

type FroxlorResponse<T = unknown> = {
  status?: number; // Deprecated in Froxlor 2.0+, kept for backward compatibility
  status_message?: string;
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
  allowed_mysqlserver?: number[]; // Froxlor 2.x: Array of allowed MySQL server IDs
  leregistered?: number;
  imap?: number | string;  // IMAP erlaubt (0 oder 1)
  pop3?: number | string;  // POP3 erlaubt (0 oder 1)
  email_imap?: number;  // Alias für Update-Requests
  email_pop3?: number;  // Alias für Update-Requests
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

export type FroxlorMysqlServer = {
  id: number;
  caption: string;
  host: string;      // Froxlor API returns "host", not "dbserver"
  dbserver?: string; // Keep for backwards compatibility
  port?: string;     // Froxlor API returns "port" as string
  dbport?: number;   // Keep for backwards compatibility
  user?: string;     // Froxlor API returns "user"
  privileged_user?: string; // Keep for backwards compatibility
  ssl?: {
    caFile?: string;
    verifyServerCertificate?: string;
  };
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
  isemaildomain?: string | number;
  iswildcarddomain?: string | number;
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
  dbserver: number | string;
  customerid: number;
  password?: string;
  databasename_prefix?: string;
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
  email_imap?: number;  // IMAP erlauben (0 oder 1)
  email_pop3?: number;  // POP3 erlauben (0 oder 1)
  subdomains?: number;
  deactivated: number;
  documentroot?: string;
  allowed_phpconfigs?: number[]; // Froxlor 2.x expects array of PHP config IDs
  allowed_mysqlserver?: number[]; // Froxlor 2.x expects array of MySQL server IDs
  phpenabled?: number;
  perlenabled?: number;
  dnsenabled?: number;
  logviewenabled?: number;
  leregistered?: number;
};

export type FroxlorCustomerUpdateInput = Partial<Omit<FroxlorCustomerCreateInput, 'password' | 'loginname'>> & {
  password?: string;
  loginname?: string;
  // Note: allowed_phpconfigs is now included from FroxlorCustomerCreateInput (Froxlor 2.x uses same parameter for update)
};

export class FroxlorClient {
  private config: FroxlorConfig;

  constructor(config: FroxlorConfig) {
    this.config = config;
  }

  /**
   * Make a request to the Froxlor API
   * Supports both legacy (1.x) and modern (2.0+) authentication
   */
  private async request<T = unknown>(
    command: string,
    params: Record<string, unknown> = {},
    timeoutMs: number = 10000
  ): Promise<FroxlorResponse<T>> {
    const apiUrl = `${this.config.url.replace(/\/$/, '')}/api.php`;

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Determine API version (default to 2.0+)
    const isLegacyApi = this.config.version === '1.x';

    try {
      let response: Response;

      if (isLegacyApi) {
        // Legacy Froxlor 1.x: apikey/secret in request body
        response = await fetch(apiUrl, {
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
      } else {
        // Modern Froxlor 2.0+: HTTP Basic Authentication
        // Validate and sanitize API credentials to prevent invalid header errors
        const apiKey = this.config.apiKey?.trim() || '';
        const apiSecret = this.config.apiSecret?.trim() || '';

        if (!apiKey || !apiSecret) {
          throw new Error('API key and secret are required for authentication');
        }

        // Check for invalid characters that could cause "Invalid request header" errors
        const invalidCharsPattern = /[\r\n\0]/;
        if (invalidCharsPattern.test(apiKey) || invalidCharsPattern.test(apiSecret)) {
          throw new Error('API credentials contain invalid characters (newlines or null bytes)');
        }

        const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authString}`,
          },
          body: JSON.stringify({
            command,
            params,
          }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      const jsonResponse = await response.json();

      if (!response.ok) {
        // Both versions use status_message for errors (HTTP 400+)
        const errorMsg = jsonResponse?.status_message || jsonResponse?.message || response.statusText;
        throw new Error(`HTTP ${response.status}: ${errorMsg}`);
      }

      // Success handling differs by version:
      // - Froxlor 1.x: Uses status field (200 = success)
      // - Froxlor 2.0+: Uses data field presence (HTTP 200 + data = success)
      return jsonResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Froxlor API request timeout (${timeoutMs / 1000}s)`);
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

      // Check success based on API version
      const isLegacyApi = this.config.version === '1.x';
      const isSuccess = isLegacyApi
        ? result.status === 200
        : (result.data !== undefined && result.data !== null);

      if (isSuccess) {
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

      if (result.data) {
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

        if (customer) {
          // Listing gibt nicht alle Felder zurück (z.B. imap, pop3)
          // Daher laden wir die vollständigen Kundendaten mit Customers.get
          const fullCustomer = await this.getCustomer(customer.customerid);
          return fullCustomer || customer;
        }
      }

      return null;
    } catch (error) {
      // Only log unexpected errors, not credential issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Invalid request header') &&
          !errorMessage.includes('API credentials') &&
          !errorMessage.includes('API key and secret')) {
        console.error('Error finding customer:', error);
      }
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

      if (result.data) {
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
        // IMAP/POP3 Berechtigung
        email_imap: data.email_imap ?? 1,  // Standard: IMAP erlaubt
        email_pop3: data.email_pop3 ?? 1,  // Standard: POP3 erlaubt
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
      // Froxlor 2.x expects this as 'allowed_phpconfigs' (array of IDs)
      if (data.allowed_phpconfigs) {
        apiParams.allowed_phpconfigs = data.allowed_phpconfigs;
      }

      // Add allowed MySQL servers if provided
      // Froxlor 2.x expects this as 'allowed_mysqlserver' (array of IDs)
      if (data.allowed_mysqlserver) {
        apiParams.allowed_mysqlserver = data.allowed_mysqlserver;
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

      if (result.data) {
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

      if (result.data) {
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

      if (result.data) {
        return normalizeFroxlorList(result.data);
      }

      return [];
    } catch (error) {
      console.error('Error getting PHP configs:', error);
      return [];
    }
  }

  /**
   * Get all available MySQL servers from Froxlor
   */
  async getMysqlServers(): Promise<FroxlorMysqlServer[]> {
    try {
      const result = await this.request<FroxlorListingPayload<FroxlorMysqlServer>>('MysqlServer.listing');

      if (result.data) {
        return normalizeFroxlorList(result.data);
      }

      return [];
    } catch (error) {
      console.error('Error getting MySQL servers:', error);
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

      if (result.data) {
        return normalizeFroxlorList(result.data);
      }

      return [];
    } catch (error) {
      console.error('Error fetching FTP accounts:', error);
      return [];
    }
  }

  /**
   * Update FTP account password
   * @param ftpId - FTP account ID
   * @param customerId - Customer ID (required when called as admin)
   * @param newPassword - New password to set
   */
  async updateFtpPassword(ftpId: number, customerId: number, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.request('Ftps.update', {
        id: ftpId,
        customerid: customerId,
        ftp_password: newPassword,
      });

      return {
        success: true,
        message: 'FTP-Passwort erfolgreich aktualisiert',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Aktualisieren des FTP-Passworts',
      };
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

      if (result.data) {
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

      if (result.data) {
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
   * selectserveralias: 0 = wildcard (*), 1 = www-alias, 2 = none
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
      selectserveralias: number;
    }>
  ): Promise<{ success: boolean; message: string; domain?: FroxlorDomain }> {
    try {
      const result = await this.request<FroxlorDomain>('Domains.update', {
        id: domainId,
        ...data,
      });

      if (result.data) {
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

      if (result.data) {
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
    description?: string,
    dbServerId?: number
  ): Promise<{ success: boolean; message: string; database?: FroxlorDatabase; databaseName?: string }> {
    try {
      const params: Record<string, unknown> = {
        customerid: customerId,
        mysql_password: password,
        description: description || 'Joomla Database',
        sendinfomail: 0, // Don't send email
      };

      // Add mysql_server parameter if specified (Froxlor 2.x uses 'mysql_server' not 'dbserver')
      if (dbServerId !== undefined) {
        params.mysql_server = dbServerId;
        console.log(`[DEBUG FroxlorClient.createDatabase] mysql_server parameter set to: ${dbServerId}`);
      } else {
        console.log(`[DEBUG FroxlorClient.createDatabase] No mysql_server specified, using Froxlor default`);
      }

      console.log(`[DEBUG FroxlorClient.createDatabase] Final params:`, JSON.stringify(params, null, 2));

      const result = await this.request<FroxlorDatabase>('Mysqls.add', params);

      if (result.data) {
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
      // Use 30s timeout for database operations (listing can be slow with many DBs)
      const listResult = await this.request<FroxlorListingPayload<FroxlorDatabase>>('Mysqls.listing', {}, 30000);

      if (!listResult.data) {
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
      // Use 30s timeout for delete operation
      const result = await this.request('Mysqls.delete', {
        id: database.id,
        customerid: database.customerid,
      }, 30000);

      if (result.data !== undefined) {
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

  /**
   * Get all email addresses for a customer
   * Uses Emails.listing API endpoint
   */
  async getCustomerEmailAddresses(customerId: number): Promise<FroxlorEmailAddress[]> {
    try {
      const result = await this.request<FroxlorListingPayload<FroxlorEmailAddress>>('Emails.listing', {
        customerid: customerId,
      });

      if (!result.data) {
        return [];
      }

      return normalizeFroxlorList(result.data);
    } catch (error) {
      console.error('Error fetching email addresses:', error);
      return [];
    }
  }

  /**
   * Get all email forwarders for a customer
   * Uses EmailForwarders.listing API endpoint
   */
  async getCustomerEmailForwarders(customerId: number): Promise<FroxlorEmailForwarder[]> {
    try {
      const result = await this.request<FroxlorListingPayload<FroxlorEmailForwarder>>('EmailForwarders.listing', {
        customerid: customerId,
      });

      if (!result.data) {
        return [];
      }

      return normalizeFroxlorList(result.data);
    } catch (error) {
      console.error('Error fetching email forwarders:', error);
      return [];
    }
  }

  // ============================================
  // E-Mail Management Methods
  // ============================================

  /**
   * Create a new email address
   * This creates the email address entry, but not a mailbox yet
   */
  async createEmailAddress(data: FroxlorEmailAddInput): Promise<{ success: boolean; message: string; email?: FroxlorEmailAddress }> {
    try {
      const result = await this.request<FroxlorEmailAddress>('Emails.add', {
        email_part: data.email_part,
        domain: data.domain,
        customerid: data.customerid,
        loginname: data.loginname,
        iscatchall: data.iscatchall ?? 0,
        description: data.description ?? '',
      });

      if (result.data) {
        return {
          success: true,
          message: 'E-Mail-Adresse erfolgreich angelegt',
          email: result.data,
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Anlegen der E-Mail-Adresse',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Anlegen der E-Mail-Adresse',
      };
    }
  }

  /**
   * Get a specific email address by ID or email string
   */
  async getEmailAddress(emailIdOrAddress: number | string, customerId?: number): Promise<FroxlorEmailAddress | null> {
    try {
      const params: Record<string, unknown> = typeof emailIdOrAddress === 'number'
        ? { id: emailIdOrAddress }
        : { emailaddr: emailIdOrAddress };

      if (customerId) {
        params.customerid = customerId;
      }

      const result = await this.request<FroxlorEmailAddress>('Emails.get', params);

      if (result.data) {
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('Error getting email address:', error);
      return null;
    }
  }

  /**
   * Update an email address settings
   */
  async updateEmailAddress(
    emailIdOrAddress: number | string,
    customerId: number,
    data: {
      iscatchall?: number;
      description?: string;
      spam_tag_level?: number;
      spam_kill_level?: number;
      bypass_spam?: number;
      policy_greylist?: number;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const params: Record<string, unknown> = typeof emailIdOrAddress === 'number'
        ? { id: emailIdOrAddress }
        : { emailaddr: emailIdOrAddress };

      params.customerid = customerId;
      Object.assign(params, data);

      const result = await this.request('Emails.update', params);

      if (result.data !== undefined) {
        return {
          success: true,
          message: 'E-Mail-Adresse erfolgreich aktualisiert',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Aktualisieren der E-Mail-Adresse',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Aktualisieren der E-Mail-Adresse',
      };
    }
  }

  /**
   * Delete an email address
   */
  async deleteEmailAddress(
    emailIdOrAddress: number | string,
    customerId: number,
    deleteData: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    try {
      const params: Record<string, unknown> = typeof emailIdOrAddress === 'number'
        ? { id: emailIdOrAddress }
        : { emailaddr: emailIdOrAddress };

      params.customerid = customerId;
      params.delete_userfiles = deleteData ? 1 : 0;

      const result = await this.request('Emails.delete', params);

      if (result.data !== undefined) {
        return {
          success: true,
          message: 'E-Mail-Adresse erfolgreich gelöscht',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Löschen der E-Mail-Adresse',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Löschen der E-Mail-Adresse',
      };
    }
  }

  // ============================================
  // E-Mail Account (Mailbox) Methods
  // ============================================

  /**
   * Create a mailbox for an email address
   * The email address must exist first (created via createEmailAddress)
   */
  async createEmailAccount(data: FroxlorEmailAccountAddInput): Promise<{ success: boolean; message: string }> {
    try {
      // Nur die erforderlichen Parameter senden
      // email_quota: 0 = unlimited, > 0 = quota in MB
      const params: Record<string, unknown> = {
        emailaddr: data.emailaddr,
        email_password: data.email_password,
      };

      // Optionale Parameter nur hinzufügen wenn gesetzt
      if (data.customerid !== undefined) {
        params.customerid = data.customerid;
      }
      if (data.loginname) {
        params.loginname = data.loginname;
      }
      if (data.email_quota !== undefined && data.email_quota > 0) {
        params.email_quota = data.email_quota;
      }
      if (data.alternative_email) {
        params.alternative_email = data.alternative_email;
      }
      if (data.sendinfomail) {
        params.sendinfomail = data.sendinfomail;
      }

      const result = await this.request('EmailAccounts.add', params);

      if (result.data !== undefined) {
        return {
          success: true,
          message: 'E-Mail-Konto erfolgreich angelegt',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Anlegen des E-Mail-Kontos',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Anlegen des E-Mail-Kontos',
      };
    }
  }

  /**
   * Update an email account (change password, quota)
   */
  async updateEmailAccount(
    emailIdOrAddress: number | string,
    customerId: number,
    data: {
      email_password?: string;
      email_quota?: number;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const params: Record<string, unknown> = typeof emailIdOrAddress === 'number'
        ? { id: emailIdOrAddress }
        : { emailaddr: emailIdOrAddress };

      params.customerid = customerId;

      if (data.email_password) {
        params.email_password = data.email_password;
      }
      if (data.email_quota !== undefined) {
        params.email_quota = data.email_quota;
      }

      const result = await this.request('EmailAccounts.update', params);

      if (result.data !== undefined) {
        return {
          success: true,
          message: 'E-Mail-Konto erfolgreich aktualisiert',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Aktualisieren des E-Mail-Kontos',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Aktualisieren des E-Mail-Kontos',
      };
    }
  }

  /**
   * Delete a mailbox from an email address
   * This removes the mailbox but keeps the email address
   */
  async deleteEmailAccount(
    emailIdOrAddress: number | string,
    customerId: number,
    deleteData: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    try {
      const params: Record<string, unknown> = typeof emailIdOrAddress === 'number'
        ? { id: emailIdOrAddress }
        : { emailaddr: emailIdOrAddress };

      params.customerid = customerId;
      params.delete_userfiles = deleteData ? 1 : 0;

      const result = await this.request('EmailAccounts.delete', params);

      if (result.data !== undefined) {
        return {
          success: true,
          message: 'E-Mail-Konto erfolgreich gelöscht',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Löschen des E-Mail-Kontos',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Löschen des E-Mail-Kontos',
      };
    }
  }

  // ============================================
  // E-Mail Forwarder Methods
  // ============================================

  /**
   * Add a forwarder to an email address
   */
  async createEmailForwarder(data: FroxlorEmailForwarderAddInput): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.request('EmailForwarders.add', {
        emailaddr: data.emailaddr,
        destination: data.destination,
        customerid: data.customerid,
        loginname: data.loginname,
      });

      if (result.data !== undefined) {
        return {
          success: true,
          message: 'Weiterleitung erfolgreich angelegt',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Anlegen der Weiterleitung',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Anlegen der Weiterleitung',
      };
    }
  }

  /**
   * Delete a forwarder from an email address
   */
  async deleteEmailForwarder(
    forwarderId: number,
    emailIdOrAddress: number | string,
    customerId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const params: Record<string, unknown> = {
        id: forwarderId,
        customerid: customerId,
      };

      if (typeof emailIdOrAddress === 'number') {
        params.email_id = emailIdOrAddress;
      } else {
        params.emailaddr = emailIdOrAddress;
      }

      const result = await this.request('EmailForwarders.delete', params);

      if (result.data !== undefined) {
        return {
          success: true,
          message: 'Weiterleitung erfolgreich gelöscht',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Löschen der Weiterleitung',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Löschen der Weiterleitung',
      };
    }
  }

  // ============================================
  // Domain Management Methods (Extended)
  // ============================================

  /**
   * Add a new domain to a customer
   */
  async addDomain(data: FroxlorDomainAddInput): Promise<{ success: boolean; message: string; domain?: FroxlorDomain }> {
    try {
      const params: Record<string, unknown> = {
        domain: data.domain,
        isemaildomain: data.isemaildomain ?? 1,
        iswildcarddomain: data.iswildcarddomain ?? 0,
        subcanemaildomain: data.subcanemaildomain ?? 0,
        letsencrypt: data.letsencrypt ?? 1,
        ssl_redirect: data.ssl_redirect ?? 1,
        hsts: data.hsts ?? 0,
        phpenabled: data.phpenabled ?? 1,
        openbasedir: data.openbasedir ?? 1,
      };

      if (data.customerid) {
        params.customerid = data.customerid;
      }
      if (data.loginname) {
        params.loginname = data.loginname;
      }
      if (data.documentroot) {
        params.documentroot = data.documentroot;
      }
      if (data.phpsettingid) {
        params.phpsettingid = data.phpsettingid;
      }
      if (data.specialsettings) {
        params.specialsettings = data.specialsettings;
      }

      const result = await this.request<FroxlorDomain>('Domains.add', params);

      if (result.data) {
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
   * Delete a domain
   */
  async deleteDomain(domainIdOrName: number | string): Promise<{ success: boolean; message: string }> {
    try {
      const params: Record<string, unknown> = typeof domainIdOrName === 'number'
        ? { id: domainIdOrName }
        : { domainname: domainIdOrName };

      const result = await this.request('Domains.delete', params);

      if (result.data !== undefined) {
        return {
          success: true,
          message: 'Domain erfolgreich gelöscht',
        };
      }

      return {
        success: false,
        message: result.status_message || 'Fehler beim Löschen der Domain',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler beim Löschen der Domain',
      };
    }
  }

  /**
   * Get a domain by ID or name
   */
  async getDomain(domainIdOrName: number | string): Promise<FroxlorDomain | null> {
    try {
      const params: Record<string, unknown> = typeof domainIdOrName === 'number'
        ? { id: domainIdOrName }
        : { domainname: domainIdOrName };

      const result = await this.request<FroxlorDomain>('Domains.get', params);

      if (result.data) {
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('Error getting domain:', error);
      return null;
    }
  }

  /**
   * Get all domains that can be used for email (isemaildomain = 1)
   */
  async getCustomerEmailDomains(customerId: number): Promise<FroxlorDomain[]> {
    try {
      const domains = await this.getCustomerDomains(customerId);
      return domains.filter(d => d.isemaildomain === '1' || d.isemaildomain === 1);
    } catch (error) {
      console.error('Error getting email domains:', error);
      return [];
    }
  }
}

export type FroxlorEmailAddress = {
  id: number;
  customerid: number;
  domainid: number;
  email: string;
  email_full: string;
  destination: string;
  iscatchall: number;
  popaccountid: number;
  domain?: string;
};

export type FroxlorEmailForwarder = {
  id: number;
  customerid: number;
  domainid: number;
  email: string;
  email_full: string;
  destination: string;
  domain?: string;
};

export type FroxlorEmailAccount = {
  id: number;
  customerid: number;
  email: string;
  email_full: string;
  username: string;
  quota: number;
  quota_used: number;
  imap: number;
  pop3: number;
  domainid: number;
};

export type FroxlorEmailAddInput = {
  email_part: string;  // The local part (before @)
  domain: string;      // Domain name or domain ID
  customerid?: number;
  loginname?: string;
  spam_tag_level?: number;
  spam_kill_level?: number;
  bypass_spam?: number;
  policy_greylist?: number;
  iscatchall?: number;
  description?: string;
};

export type FroxlorEmailAccountAddInput = {
  emailaddr: string;   // Full email address or email ID
  email_password: string;
  customerid?: number;
  loginname?: string;
  email_quota?: number;  // Quota in MB
  alternative_email?: string;
  sendinfomail?: number;
};

export type FroxlorEmailForwarderAddInput = {
  emailaddr: string;   // Full email address or email ID
  destination: string; // Destination email address
  customerid?: number;
  loginname?: string;
};

export type FroxlorDomainAddInput = {
  domain: string;
  customerid?: number;
  loginname?: string;
  isemaildomain?: number;
  iswildcarddomain?: number;
  subcanemaildomain?: number;
  letsencrypt?: number;
  ssl_redirect?: number;
  hsts?: number;
  phpenabled?: number;
  openbasedir?: number;
  documentroot?: string;
  phpsettingid?: number;
  specialsettings?: string;
};
