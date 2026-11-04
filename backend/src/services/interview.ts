export interface SlotValidationResult {
  valid: boolean;
  error?: string;
  slotDisplay?: string;
}

export async function validateInterviewSlot(
  db: D1Database,
  slotDate: string,
  slotTime: string,
  rawSlotDisplay?: string
): Promise<SlotValidationResult> {
  const date = (slotDate || '').trim();
  const time = (slotTime || '').trim();
  const display = (rawSlotDisplay || `${date} ${time}`).trim().slice(0, 200);

  if (!date || !time) {
    return { valid: false, error: 'slot_date and slot_time are required' };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { valid: false, error: 'slot_date must use YYYY-MM-DD format' };
  }

  const slotDay = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(slotDay.getTime()) || slotDay.toISOString().slice(0, 10) !== date) {
    return { valid: false, error: 'slot_date is not a valid calendar date' };
  }

  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);
  if (slotDay.getTime() < startOfTodayUtc.getTime()) {
    return { valid: false, error: 'slot_date cannot be in the past' };
  }

  const settingsRow = await db
    .prepare('SELECT slots_json FROM interview_settings WHERE id = 1')
    .first<{ slots_json: string }>();

  let allowedTimes = ["11:00 AM", "03:00 PM", "05:30 PM", "07:00 PM"];
  if (settingsRow?.slots_json) {
    try {
      const parsed = JSON.parse(settingsRow.slots_json);
      if (Array.isArray(parsed) && parsed.length > 0) allowedTimes = parsed;
    } catch {}
  }

  if (!allowedTimes.includes(time)) {
    return { valid: false, error: 'slot_time is not an offered interview time' };
  }

  return { valid: true, slotDisplay: display };
}
