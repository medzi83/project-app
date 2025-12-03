import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notFound, redirect } from "next/navigation";
import WebDokuClient from "./WebDokuClient";

type Props = { params: Promise<{ id: string }> };

export default async function WebDokuPage({ params }: Props) {
  const { id } = await params;
  const session = await requireRole(["ADMIN", "AGENT", "SALES"]);
  if (!session) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          authorizedPersons: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      website: {
        include: {
          webDocumentation: {
            include: {
              contacts: {
                include: {
                  authorizedPerson: true,
                },
                orderBy: [
                  { isPrimary: "desc" },
                  { createdAt: "asc" },
                ],
              },
              menuItems: {
                orderBy: [
                  { sortOrder: "asc" },
                ],
              },
              forms: {
                orderBy: [
                  { sortOrder: "asc" },
                ],
                include: {
                  fields: {
                    orderBy: [
                      { sortOrder: "asc" },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();
  if (!project.website) notFound();
  if (!project.website.webDocumentation) {
    // Webdoku existiert noch nicht - zurück zur Projektseite
    redirect(`/projects/${id}`);
  }

  const webDoc = project.website.webDocumentation;

  return (
    <WebDokuClient
      projectId={id}
      webDoc={{
        projectId: webDoc.projectId,
        contactEmail: webDoc.contactEmail,
        urgentNotes: webDoc.urgentNotes,
        websiteDomain: webDoc.websiteDomain,
        domainStatus: webDoc.domainStatus,
        companyName: webDoc.companyName,
        companyFocus: webDoc.companyFocus,
        contacts: webDoc.contacts.map((c) => ({
          id: c.id,
          isPrimary: c.isPrimary,
          authorizedPerson: {
            id: c.authorizedPerson.id,
            salutation: c.authorizedPerson.salutation,
            firstname: c.authorizedPerson.firstname,
            lastname: c.authorizedPerson.lastname,
            email: c.authorizedPerson.email,
            position: c.authorizedPerson.position,
            phone: c.authorizedPerson.phone,
          },
        })),
        menuItems: webDoc.menuItems.map((m) => ({
          id: m.id,
          name: m.name,
          parentId: m.parentId,
          sortOrder: m.sortOrder,
          isFooterMenu: m.isFooterMenu,
          notes: m.notes,
          // Schritt 7: Material
          needsImages: m.needsImages,
          needsTexts: m.needsTexts,
          materialNotes: m.materialNotes,
        })),
        // Schritt 4: Design & Vorgaben
        hasLogo: webDoc.hasLogo,
        hasCIDefined: webDoc.hasCIDefined,
        ciColorCode: webDoc.ciColorCode,
        ciFontFamily: webDoc.ciFontFamily,
        colorOrientation: webDoc.colorOrientation,
        colorCodes: webDoc.colorCodes,
        topWebsite: webDoc.topWebsite,
        flopWebsite: webDoc.flopWebsite,
        websiteType: webDoc.websiteType,
        styleTypes: webDoc.styleTypes,
        styleCustom: webDoc.styleCustom,
        startArea: webDoc.startArea,
        slogan: webDoc.slogan,
        teaserSpecs: webDoc.teaserSpecs,
        disruptorSpecs: webDoc.disruptorSpecs,
        otherSpecs: webDoc.otherSpecs,
        mapIntegration: webDoc.mapIntegration,
        // Schritt 5: Formulare
        noFormsRequired: webDoc.noFormsRequired ?? false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forms: ((webDoc as any).forms || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          recipientEmail: f.recipientEmail,
          sortOrder: f.sortOrder,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fields: (f.fields || []).map((ff: any) => ({
            id: ff.id,
            fieldType: ff.fieldType,
            label: ff.label,
            isRequired: ff.isRequired,
            sortOrder: ff.sortOrder,
          })),
        })),
        // Schritt 6: Impressum & Datenschutz
        imprintFromWebsite: webDoc.imprintFromWebsite,
        imprintAddress: webDoc.imprintAddress,
        imprintLegalForm: webDoc.imprintLegalForm,
        imprintOwner: webDoc.imprintOwner,
        imprintCeo: webDoc.imprintCeo,
        imprintPhone: webDoc.imprintPhone,
        imprintFax: webDoc.imprintFax,
        imprintEmail: webDoc.imprintEmail,
        imprintRegisterType: webDoc.imprintRegisterType,
        imprintRegisterCustom: webDoc.imprintRegisterCustom,
        imprintRegisterLocation: webDoc.imprintRegisterLocation,
        imprintRegisterNumber: webDoc.imprintRegisterNumber,
        imprintChamber: webDoc.imprintChamber,
        imprintProfession: webDoc.imprintProfession,
        imprintCountry: webDoc.imprintCountry,
        imprintVatId: webDoc.imprintVatId,
        imprintTermsStatus: webDoc.imprintTermsStatus,
        imprintPrivacyOfficer: webDoc.imprintPrivacyOfficer,
        imprintHasPrivacyOfficer: webDoc.imprintHasPrivacyOfficer,
        // Schritt 7: Material
        materialLogoNeeded: webDoc.materialLogoNeeded,
        materialAuthcodeNeeded: webDoc.materialAuthcodeNeeded,
        materialNotes: webDoc.materialNotes,
        materialNotesNeedsImages: webDoc.materialNotesNeedsImages,
        materialNotesNeedsTexts: webDoc.materialNotesNeedsTexts,
        materialDeadline: webDoc.materialDeadline?.toISOString().split("T")[0] || null,
        // Kundenfreigabe
        releasedAt: webDoc.releasedAt?.toISOString() || null,
        releasedByName: webDoc.releasedByName,
        // Kundenbestätigung
        confirmedAt: webDoc.confirmedAt?.toISOString() || null,
        confirmedByName: webDoc.confirmedByName,
        confirmedByIp: webDoc.confirmedByIp,
        // Kundenablehnung
        rejectedAt: webDoc.rejectedAt?.toISOString() || null,
        rejectedByName: webDoc.rejectedByName,
        rejectedByIp: webDoc.rejectedByIp,
        rejectedSteps: webDoc.rejectedSteps || [],
        // Interner Vermerk
        internalNote: webDoc.internalNote,
      }}
      client={{
        id: project.client.id,
        name: project.client.name,
        customerNo: project.client.customerNo,
        email: project.client.email,
        firstname: project.client.firstname,
        lastname: project.client.lastname,
        agency: project.client.agencyId,
        authorizedPersons: project.client.authorizedPersons.map((ap) => ({
          id: ap.id,
          salutation: ap.salutation,
          firstname: ap.firstname,
          lastname: ap.lastname,
          email: ap.email,
          position: ap.position,
          phone: ap.phone,
        })),
      }}
      projectDomain={project.website.domain}
      hasTextit={project.website?.textit != null && project.website?.textit !== "NEIN"}
      isAdmin={session.user.role === "ADMIN"}
      canEdit={session.user.role === "ADMIN" || session.user.role === "AGENT"}
    />
  );
}
