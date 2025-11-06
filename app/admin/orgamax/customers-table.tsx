import { createOrgamaxClient, type OrgamaxCustomer, formatCustomerAddress, formatCustomerName } from '@/lib/orgamax-api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MapPin, Building } from 'lucide-react';

type OrgamaxCustomersTableProps = {
  mandant: 1 | 2 | 4;
  limit?: number;
};

export async function OrgamaxCustomersTable({ mandant, limit }: OrgamaxCustomersTableProps) {
  const client = createOrgamaxClient();

  if (!client) {
    return (
      <div className="text-sm text-muted-foreground">
        Orgamax API ist nicht konfiguriert.
      </div>
    );
  }

  const result = await client.getCustomers(mandant);

  if (!result.success || !result.customers) {
    return (
      <div className="text-sm text-destructive">
        Fehler beim Laden der Kunden: {result.error}
      </div>
    );
  }

  const customers = limit ? result.customers.slice(0, limit) : result.customers;

  if (customers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Keine Kunden gefunden für Mandant {mandant}.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Kd.-Nr.</TableHead>
            <TableHead>Name / Firma</TableHead>
            <TableHead>Adresse</TableHead>
            <TableHead>Kontakt</TableHead>
            <TableHead className="text-right">Typ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.ID}>
              <TableCell className="font-medium">
                <Badge variant="outline">{customer.CUSTNO}</Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">{formatCustomerName(customer)}</div>
                  {customer.KUNDENNAME && customer.KUNDENNAME !== formatCustomerName(customer) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building className="h-3 w-3" />
                      {customer.KUNDENNAME}
                    </div>
                  )}
                  {customer.NAMENSZUSATZ && (
                    <div className="text-xs text-muted-foreground">{customer.NAMENSZUSATZ}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {customer.STREET || customer.CITY ? (
                  <div className="flex items-start gap-1 text-sm">
                    <MapPin className="mt-0.5 h-3 w-3 text-muted-foreground" />
                    <div>
                      {customer.STREET && <div>{customer.STREET}</div>}
                      {(customer.ZIPCODE || customer.CITY) && (
                        <div>
                          {customer.ZIPCODE} {customer.CITY}
                        </div>
                      )}
                      {customer.COUNTRY && customer.COUNTRY !== 'D' && (
                        <div className="text-xs text-muted-foreground">{customer.COUNTRY}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1 text-sm">
                  {customer.EMAIL && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <a
                        href={`mailto:${customer.EMAIL}`}
                        className="text-blue-600 hover:underline"
                      >
                        {customer.EMAIL}
                      </a>
                    </div>
                  )}
                  {customer.PHONE1 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${customer.PHONE1}`} className="hover:underline">
                        {customer.PHONE1}
                      </a>
                    </div>
                  )}
                  {customer.MOBILE && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${customer.MOBILE}`} className="hover:underline">
                        {customer.MOBILE}
                      </a>
                    </div>
                  )}
                  {!customer.EMAIL && !customer.PHONE1 && !customer.MOBILE && (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary" className="text-xs">
                  {customer.CONTACTTYPE === 0 ? 'Firma' : 'Person'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
