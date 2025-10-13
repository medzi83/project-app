*** Begin Patch
*** Update File: Projektverwaltung/projektverwaltung/app/admin/statistics/page.tsx
@@
   const rows: MonthRow[] = monthEntries
     .sort((a, b) => b.date.getTime() - a.date.getTime())
     .map((entry) => {
       let topAgentName = "-";
       let topAgentCount = 0;
       for (const { name, count } of entry.agentCounts.values()) {
         if (count > topAgentCount) {
           topAgentName = name;
           topAgentCount = count;
         }
       }
 
+      const avgOverdueWorkingDays =
+        entry.overdueWorkingSamples > 0
+          ? entry.overdueWorkingTotal / entry.overdueWorkingSamples
+          : null;
+
       return {
         key: entry.key,
         date: entry.date,
         label: entry.label,
         webAppointments: entry.webAppointments,
         newDemos: entry.newDemos,
         goLives: entry.goLives,
-        overdueWorkingDays: entry.overdueWorkingDays,
+        avgOverdueWorkingDays,
         avgWebToOnlineDays:
           entry.webToOnlineCount > 0
             ? entry.webToOnlineTotalDays / entry.webToOnlineCount
             : null,
         topAgentName,
*** End Patch
