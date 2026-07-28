"use client";

import { loadConfiguredEventHelp } from "@/config/configured-event-help-query";
import { EventHelpScreen } from "@/modules/event-help";

export function HelpPageClient() {
  return <EventHelpScreen loadHelp={loadConfiguredEventHelp} />;
}
