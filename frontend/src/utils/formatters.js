/**
 * Formats time string or timestamp into India Standard Time (IST) 12-hour format with AM/PM.
 * Example inputs: "09:30:00", "18:45:15", "09:30", "18:45", "2026-10-22T09:30:00"
 * Example outputs: "09:30 AM", "06:45 PM"
 */
export function formatTime12Hour(timeVal) {
  if (!timeVal || timeVal === 'N/A' || timeVal === '--' || timeVal === 'null' || timeVal === 'None') {
    return '--';
  }

  // If already formatted with AM/PM e.g. "09:30 AM"
  if (typeof timeVal === 'string' && (timeVal.toUpperCase().includes('AM') || timeVal.toUpperCase().includes('PM'))) {
    return timeVal.trim();
  }

  try {
    // If it's a simple "HH:MM:SS" or "HH:MM"
    if (typeof timeVal === 'string' && timeVal.includes(':') && !timeVal.includes('T')) {
      const parts = timeVal.trim().split(':');
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1] || '00';
      if (isNaN(hours)) return timeVal;

      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 hour becomes 12
      const strHours = hours < 10 ? `0${hours}` : `${hours}`;
      const strMinutes = minutes.padStart(2, '0').slice(0, 2);
      return `${strHours}:${strMinutes} ${ampm}`;
    }

    // If it's an ISO datetime string or Date object
    const date = new Date(timeVal);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  } catch (err) {
    console.error('Error formatting time to 12-hour AM/PM:', err);
  }

  return String(timeVal);
}

/**
 * Formats date into standard readable Indian format (e.g. "22 Oct 2026" or "Thu, 22 Oct")
 */
export function formatDateDisplay(dateVal) {
  if (!dateVal || dateVal === '--') return '--';
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  } catch (e) {
    // ignore
  }
  return String(dateVal);
}
