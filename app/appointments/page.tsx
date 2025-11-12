import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, Video, Globe, User, Building2, ArrowRight, MapPin, ChevronLeft, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type AppointmentType = "WEBTERMIN" | "DREH" | "SCOUTING";

type Appointment = {
  id: string;
  type: AppointmentType;
  date: Date;
  clientId: string;
  clientName: string;
  customerNo: string;
  agentId: string | null;
  agentName: string | null;
  projectTitle: string | null;
  projectType: "WEBSITE" | "FILM";
};

// Naive date/time formatting - extracts components directly from ISO string without timezone conversion
const formatTime = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";
    // match[0] = full match, [1] = year, [2] = month, [3] = day, [4] = hours, [5] = minutes
    const hours = match[4];
    const minutes = match[5];
    return `${hours}:${minutes}`;
  } catch {
    return "-";
  }
};

const formatDate = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "-";
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
};

const formatDateTime = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "-";
  }
};

const formatDateFull = (date: Date) => {
  // Extract weekday using browser's locale but time from naive formatting
  const weekdayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

  const dateStr = date.toISOString();
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return "-";

  const [, year, month, day, hours, minutes] = match;
  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const weekday = weekdayNames[dateObj.getDay()];
  const monthName = monthNames[parseInt(month) - 1];

  return `${weekday}, ${parseInt(day)}. ${monthName} ${year} um ${hours}:${minutes}`;
};

const formatDateShort = (date: Date) => {
  return formatDate(date);
};

async function loadAppointments() {
  const now = new Date();

  // Load Webtermine (from website projects with status WEBTERMIN and webDate set)
  const websiteProjects = await prisma.project.findMany({
    where: {
      type: "WEBSITE",
      status: "WEBTERMIN",
      website: {
        webDate: {
          gte: now
        }
      }
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          customerNo: true
        }
      },
      agent: {
        select: {
          id: true,
          name: true
        }
      },
      website: {
        select: {
          webDate: true
        }
      }
    },
    orderBy: {
      website: {
        webDate: "asc"
      }
    }
  });

  // Load Drehtermine (from film projects with shootDate set)
  const filmProjectsShoot = await prisma.project.findMany({
    where: {
      type: "FILM",
      film: {
        shootDate: {
          gte: now
        }
      }
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          customerNo: true
        }
      },
      agent: {
        select: {
          id: true,
          name: true
        }
      },
      film: {
        select: {
          shootDate: true,
          scouting: true,
          filmer: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      film: {
        shootDate: "asc"
      }
    }
  });

  // Load Scouting-Termine (from film projects with scouting set)
  const filmProjectsScouting = await prisma.project.findMany({
    where: {
      type: "FILM",
      film: {
        scouting: {
          gte: now
        }
      }
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          customerNo: true
        }
      },
      agent: {
        select: {
          id: true,
          name: true
        }
      },
      film: {
        select: {
          shootDate: true,
          scouting: true,
          filmer: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      film: {
        scouting: "asc"
      }
    }
  });

  const appointments: Appointment[] = [];

  // Map website appointments
  for (const project of websiteProjects) {
    if (project.website?.webDate) {
      appointments.push({
        id: project.id,
        type: "WEBTERMIN",
        date: project.website.webDate,
        clientId: project.client.id,
        clientName: project.client.name,
        customerNo: project.client.customerNo || "-",
        agentId: project.agent?.id || null,
        agentName: project.agent?.name || null,
        projectTitle: project.title,
        projectType: "WEBSITE"
      });
    }
  }

  // Map film shoot appointments
  for (const project of filmProjectsShoot) {
    if (project.film?.shootDate) {
      appointments.push({
        id: project.id,
        type: "DREH",
        date: project.film.shootDate,
        clientId: project.client.id,
        clientName: project.client.name,
        customerNo: project.client.customerNo || "-",
        agentId: project.film.filmer?.id || project.agent?.id || null,
        agentName: project.film.filmer?.name || project.agent?.name || null,
        projectTitle: project.title,
        projectType: "FILM"
      });
    }
  }

  // Map scouting appointments
  for (const project of filmProjectsScouting) {
    if (project.film?.scouting) {
      appointments.push({
        id: project.id,
        type: "SCOUTING",
        date: project.film.scouting,
        clientId: project.client.id,
        clientName: project.client.name,
        customerNo: project.client.customerNo || "-",
        agentId: project.film.filmer?.id || project.agent?.id || null,
        agentName: project.film.filmer?.name || project.agent?.name || null,
        projectTitle: project.title,
        projectType: "FILM"
      });
    }
  }

  // Sort all appointments by date
  appointments.sort((a, b) => a.date.getTime() - b.date.getTime());

  return appointments;
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppointmentsPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session || !session.user.id) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT", "SALES"].includes(session.user.role)) {
    redirect("/");
  }

  const appointments = await loadAppointments();

  const webtermine = appointments.filter(a => a.type === "WEBTERMIN");
  const scoutingtermine = appointments.filter(a => a.type === "SCOUTING");
  const drehtermine = appointments.filter(a => a.type === "DREH");

  const spRaw = await searchParams;
  const defaultTab = spRaw.tab as string || "calendar";
  const monthParam = spRaw.month ? parseInt(spRaw.month as string) : new Date().getMonth();
  const yearParam = spRaw.year ? parseInt(spRaw.year as string) : new Date().getFullYear();

  return (
    <div className="w-full space-y-6 py-6 px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
          <Calendar className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Termine</h1>
          <p className="text-sm text-muted-foreground">
            {appointments.length} anstehende Termine
          </p>
        </div>
      </div>

      {/* Appointments Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="calendar">Kalender</TabsTrigger>
          <TabsTrigger value="all">Alle ({appointments.length})</TabsTrigger>
          <TabsTrigger value="web">Webtermine ({webtermine.length})</TabsTrigger>
          <TabsTrigger value="scouting">Scouting ({scoutingtermine.length})</TabsTrigger>
          <TabsTrigger value="film">Drehtermine ({drehtermine.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView appointments={appointments} currentMonth={monthParam} currentYear={yearParam} />
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-6">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Keine anstehenden Termine vorhanden.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="web" className="space-y-4 mt-6">
          {webtermine.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Keine anstehenden Webtermine vorhanden.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {webtermine.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scouting" className="space-y-4 mt-6">
          {scoutingtermine.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Keine anstehenden Scouting-Termine vorhanden.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {scoutingtermine.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="film" className="space-y-4 mt-6">
          {drehtermine.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Keine anstehenden Drehtermine vorhanden.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {drehtermine.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const isWebtermin = appointment.type === "WEBTERMIN";
  const isScouting = appointment.type === "SCOUTING";
  const isDreh = appointment.type === "DREH";

  const projectUrl = isWebtermin
    ? `/projects/${appointment.id}`
    : `/film-projects/${appointment.id}`;

  const cardColor = isWebtermin
    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
    : isScouting
    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
    : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";

  const badgeVariant = isWebtermin ? "default" : isScouting ? "outline" : "secondary";
  const badgeLabel = isWebtermin ? "Webtermin" : isScouting ? "Scouting" : "Drehtermin";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Icon */}
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${cardColor}`}>
              {isWebtermin ? (
                <Globe className="h-6 w-6" />
              ) : isScouting ? (
                <MapPin className="h-6 w-6" />
              ) : (
                <Video className="h-6 w-6" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={badgeVariant}>
                  {badgeLabel}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateShort(appointment.date)} um {formatTime(appointment.date)}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-lg">
                  {appointment.clientName}
                </h3>
                {appointment.projectTitle && (
                  <p className="text-sm text-muted-foreground">{appointment.projectTitle}</p>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Kd.-Nr.:</span>
                  <Link
                    href={`/clients/${appointment.clientId}`}
                    className="font-medium hover:underline text-primary"
                  >
                    {appointment.customerNo}
                  </Link>
                </div>

                {appointment.agentName && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Agent:</span>
                    <span className="font-medium">{appointment.agentName}</span>
                  </div>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                {formatDateFull(appointment.date)}
              </div>
            </div>
          </div>

          {/* Action */}
          <Link
            href={projectUrl}
            className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Zum Projekt
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarView({ appointments, currentMonth, currentYear }: { appointments: Appointment[]; currentMonth: number; currentYear: number }) {
  // Get the first day of the month and the number of days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Adjust to make Monday the first day (0 = Monday, 6 = Sunday)
  const adjustedStartDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

  // Month names
  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  // Create array of day objects
  const days: Array<{ date: number | null; appointments: Appointment[] }> = [];

  // Add empty cells for days before the first of the month
  for (let i = 0; i < adjustedStartDay; i++) {
    days.push({ date: null, appointments: [] });
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayAppointments = appointments.filter(apt => {
      // Naive date extraction - parse directly from ISO string without timezone conversion
      const dateStr = apt.date instanceof Date ? apt.date.toISOString() : apt.date;
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return false;

      const [, year, month, dayStr] = match;
      return parseInt(dayStr) === day &&
             parseInt(month) - 1 === currentMonth &&
             parseInt(year) === currentYear;
    });
    days.push({ date: day, appointments: dayAppointments });
  }

  // Navigation URLs
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">
            {monthNames[currentMonth]} {currentYear}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href={`/appointments?tab=calendar&month=${prevMonth}&year=${prevYear}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href={`/appointments?tab=calendar`}>
                Heute
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href={`/appointments?tab=calendar&month=${nextMonth}&year=${nextYear}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {/* Weekday headers */}
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day, index) => (
            <div
              key={index}
              className={`min-h-[120px] border rounded-lg p-2 ${
                day.date === null
                  ? "bg-muted/30"
                  : isToday(day.date)
                  ? "bg-blue-50 dark:bg-blue-950/20 border-blue-500"
                  : "bg-card hover:bg-muted/50"
              } transition-colors`}
            >
              {day.date !== null && (
                <>
                  <div className={`text-sm font-medium mb-2 ${
                    isToday(day.date) ? "text-blue-600 dark:text-blue-400" : ""
                  }`}>
                    {day.date}
                  </div>
                  <div className="space-y-1.5">
                    {day.appointments.map((apt) => {
                      const isWebtermin = apt.type === "WEBTERMIN";
                      const isScouting = apt.type === "SCOUTING";
                      const projectUrl = isWebtermin
                        ? `/projects/${apt.id}`
                        : `/film-projects/${apt.id}`;

                      const bgColor = isWebtermin
                        ? "bg-blue-500 hover:bg-blue-600"
                        : isScouting
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-purple-500 hover:bg-purple-600";

                      const typeLabel = isWebtermin ? "Web" : isScouting ? "Scout" : "Dreh";

                      return (
                        <Link
                          key={apt.id}
                          href={projectUrl}
                          className={`block text-xs text-white rounded px-2 py-1.5 ${bgColor} transition-colors`}
                          title={`${apt.clientName} (${apt.customerNo}) - ${formatTime(apt.date)}${apt.agentName ? ` - ${apt.agentName}` : ''}`}
                        >
                          <div className="space-y-0.5">
                            {/* First row: Time and Type */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {isWebtermin ? (
                                  <Globe className="h-3 w-3" />
                                ) : isScouting ? (
                                  <MapPin className="h-3 w-3" />
                                ) : (
                                  <Video className="h-3 w-3" />
                                )}
                                <span className="font-semibold">{formatTime(apt.date)}</span>
                              </div>
                              <span className="text-[10px] opacity-90 uppercase font-medium">{typeLabel}</span>
                            </div>
                            {/* Second row: Client name */}
                            <div className="font-medium truncate">
                              {apt.clientName}
                            </div>
                            {/* Third row: Customer number and agent */}
                            <div className="flex items-center justify-between gap-1 text-[10px] opacity-90">
                              <span className="truncate">Kd. {apt.customerNo}</span>
                              {apt.agentName && (
                                <span className="truncate flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" />
                                  {apt.agentName.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
