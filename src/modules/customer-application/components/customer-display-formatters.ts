const eventDateFormatter = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Singapore",
});

const eventDateTimeFormatter = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "Asia/Singapore",
});

const paynowAmountFormatter = new Intl.NumberFormat("en-SG", {
  currency: "SGD",
  style: "currency",
});

export function formatCustomerEventDateRange(
  startsAt: string,
  endsAt: string,
): string {
  return `${eventDateFormatter.format(new Date(startsAt))} – ${eventDateFormatter.format(new Date(endsAt))}`;
}

export function formatCustomerTransactionTime(occurredAt: string): string {
  return eventDateTimeFormatter.format(new Date(occurredAt));
}

export function formatPaynowAmount(paynowAmountCents: number): string {
  return paynowAmountFormatter.format(paynowAmountCents / 100);
}
