var d2SelectedCalendarEventKey = "";

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarEventRange(event = {}) {
  const start = event.startIso ? new Date(event.startIso) : calendarDateTime(event.date, event.time);
  if (!start || Number.isNaN(start.getTime())) return null;
  let end = event.endIso ? new Date(event.endIso) : null;
  if (!end || Number.isNaN(end.getTime()) || end < start) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }
  let endDay = dayStart(end);
  if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && endDay > dayStart(start)) {
    endDay = new Date(endDay.getTime() - 24 * 60 * 60 * 1000);
  }
  return {
    start: dayStart(start),
    end: endDay,
    startTime: start,
    endTime: end,
  };
}

function eventDateKey(event) {
  const range = calendarEventRange(event);
  return range ? dateKeyFromDate(range.start) : String(event.date || "").slice(0, 10);
}

function calendarEventTouchesDate(event, dateKey) {
  const range = calendarEventRange(event);
  if (!range) return false;
  const date = dayStart(new Date(`${dateKey}T12:00:00`));
  return date >= range.start && date <= range.end;
}

function calendarEventsForDate(dateKey) {
  return allCrmCalendarEvents().filter((event) => calendarEventTouchesDate(event, dateKey));
}

function monthCalendarEvents() {
  const year = crmCalendarCursor.getFullYear();
  const month = crmCalendarCursor.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  return allCrmCalendarEvents().filter((event) => {
    const range = calendarEventRange(event);
    return range && range.start <= monthEnd && range.end >= monthStart;
  });
}

function renderCalendarEventList(targetId, events, emptyText = "No calendar events found for this view.") {
  const target = $(targetId);
  if (!target) return;
  target.innerHTML = events.length ? events.map((event) => `
    <article class="crm-calendar-event${event.eventKey === d2SelectedCalendarEventKey ? " selected" : ""}" data-calendar-select="${escapeHtml(event.eventKey)}" role="button" tabindex="0" aria-label="Open ${escapeHtml(event.title)} calendar event">
      <div class="crm-calendar-date">
        <strong>${escapeHtml(formatCalendarDate(event.date, event.time))}</strong>
        <span>${escapeHtml(event.typeLabel)}</span>
      </div>
      <div class="crm-calendar-info">
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.fileNumber)} · ${escapeHtml(event.address || "No address added")}</p>
        <p>${escapeHtml(event.phone || "No phone")}${event.email ? ` · ${escapeHtml(event.email)}` : ""}</p>
      </div>
      <div class="crm-calendar-event-actions">
        ${event.fileId ? `<button type="button" data-calendar-open="${escapeHtml(event.fileId)}">Open File</button>` : ""}
        ${event.source === "google" ? "" : `<button type="button" data-calendar-sync="${escapeHtml(event.eventKey)}">Sync</button>`}
      </div>
    </article>
  `).join("") : `<p class="crm-empty-state">${escapeHtml(emptyText)}</p>`;

  target.querySelectorAll("[data-calendar-open]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFileId = button.dataset.calendarOpen;
      switchCrmView("dashboard");
      renderCrm();
    });
  });
  target.querySelectorAll("[data-calendar-sync]").forEach((button) => {
    button.addEventListener("click", () => syncCalendarEventByKey(button.dataset.calendarSync));
  });
  target.querySelectorAll("[data-calendar-select]").forEach((eventCard) => {
    eventCard.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      selectCalendarEvent(eventCard.dataset.calendarSelect);
    });
    eventCard.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectCalendarEvent(eventCard.dataset.calendarSelect);
    });
  });
}

function renderCalendarGrid() {
  const grid = $("crmCalendarGrid");
  if (!grid) return;
  const monthTitle = $("crmCalendarMonthTitle");
  if (monthTitle) {
    monthTitle.textContent = crmCalendarCursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  }
  const year = crmCalendarCursor.getFullYear();
  const month = crmCalendarCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
  const todayKey = todayIso(0);
  const monthEvents = monthCalendarEvents();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const parts = [`<div class="crm-calendar-weekdays">${dayNames.map((day) => `<div class="crm-calendar-weekday">${day}</div>`).join("")}</div>`];
  for (let week = 0; week < 6; week += 1) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + week * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + day);
      const key = dateKeyFromDate(date);
      const events = calendarEventsForDate(key);
      const isCurrentMonth = date.getMonth() === month;
      const isToday = key === todayKey;
      const isSelected = key === crmSelectedCalendarDate;
      days.push(`
        <button type="button" class="crm-calendar-day${isCurrentMonth ? "" : " muted"}${isToday ? " today" : ""}${isSelected ? " selected" : ""}" data-calendar-day="${escapeHtml(key)}">
          <span class="crm-calendar-day-number">${date.getDate()}</span>
          <span class="crm-calendar-day-count">${events.length ? `${events.length} event${events.length === 1 ? "" : "s"}` : ""}</span>
        </button>
      `);
    }
    const bars = calendarEventBarsForWeek(monthEvents, weekStart, weekEnd);
    parts.push(`
      <div class="crm-calendar-week-row">
        <div class="crm-calendar-week-days">${days.join("")}</div>
        <div class="crm-calendar-week-bars">
          ${bars.map((bar) => `
            <button type="button" class="crm-calendar-chip crm-calendar-bar ${escapeHtml(bar.event.type)}${bar.event.eventKey === d2SelectedCalendarEventKey ? " selected" : ""}" style="grid-column: ${bar.column} / span ${bar.span}; grid-row: ${bar.row};" data-calendar-event-key="${escapeHtml(bar.event.eventKey)}" data-calendar-event-day="${escapeHtml(bar.dateKey)}" title="${escapeHtml(bar.title)}">
              ${escapeHtml(bar.title)}
            </button>
          `).join("")}
        </div>
      </div>
    `);
  }
  grid.innerHTML = parts.join("");
  grid.querySelectorAll("[data-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => {
      crmSelectedCalendarDate = button.dataset.calendarDay;
      d2SelectedCalendarEventKey = "";
      $("crmCalendarDate").value = crmSelectedCalendarDate;
      if ($("crmCalendarNotes")) $("crmCalendarNotes").value = "";
      renderCalendarGrid();
      renderCalendarSelectedDay();
    });
  });
  grid.querySelectorAll("[data-calendar-event-day]").forEach((button) => {
    button.addEventListener("click", () => {
      crmSelectedCalendarDate = button.dataset.calendarEventDay;
      $("crmCalendarDate").value = crmSelectedCalendarDate;
      selectCalendarEvent(button.dataset.calendarEventKey || "");
    });
  });
}

function calendarEventBarsForWeek(events, weekStart, weekEnd) {
  const lanes = [];
  return events
    .map((event) => {
      const range = calendarEventRange(event);
      if (!range || range.end < weekStart || range.start > weekEnd) return null;
      const spanStart = range.start < weekStart ? weekStart : range.start;
      const spanEnd = range.end > weekEnd ? weekEnd : range.end;
      const startOffset = Math.round((spanStart - weekStart) / (24 * 60 * 60 * 1000));
      const endOffset = Math.round((spanEnd - weekStart) / (24 * 60 * 60 * 1000));
      return {
        event,
        column: startOffset + 1,
        span: Math.max(1, endOffset - startOffset + 1),
        dateKey: dateKeyFromDate(spanStart),
        title: event.source === "google"
          ? event.title || event.clientName || "Google Calendar Event"
          : `${event.typeLabel || "Event"} · ${event.clientName || event.title || "Calendar Event"}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.column - b.column || b.span - a.span)
    .map((bar) => {
      let rowIndex = lanes.findIndex((laneEnd) => laneEnd < bar.column);
      if (rowIndex === -1) {
        rowIndex = lanes.length;
        lanes.push(0);
      }
      lanes[rowIndex] = bar.column + bar.span - 1;
      return { ...bar, row: rowIndex + 1 };
    });
}

function selectCalendarEvent(eventKey) {
  const event = allCrmCalendarEvents().find((entry) => entry.eventKey === eventKey);
  if (!event) return;
  d2SelectedCalendarEventKey = event.eventKey;
  crmSelectedCalendarDate = eventDateKey(event);
  if ($("crmCalendarDate")) $("crmCalendarDate").value = crmSelectedCalendarDate;
  if ($("crmCalendarTime")) $("crmCalendarTime").value = event.time || "";
  if ($("crmCalendarNotes")) $("crmCalendarNotes").value = event.notes || "";
  if ($("crmCalendarType") && CRM_CALENDAR_TYPES[event.type]) $("crmCalendarType").value = event.type;
  if ($("crmCalendarFile") && event.fileId) $("crmCalendarFile").value = event.fileId;
  renderCalendarGrid();
  renderCalendarAgenda();
}

const d2OriginalCaptureCalendarFormToFile = captureCalendarFormToFile;
captureCalendarFormToFile = function captureCalendarFormToFileWithGoogleNotes() {
  const selectedEvent = allCrmCalendarEvents().find((entry) => entry.eventKey === d2SelectedCalendarEventKey);
  if (selectedEvent?.source === "google") {
    crmExternalCalendarEvents = crmExternalCalendarEvents.map((event) => (
      event.eventKey === selectedEvent.eventKey
        ? {
            ...event,
            date: $("crmCalendarDate").value || event.date,
            time: $("crmCalendarTime").value || event.time,
            notes: $("crmCalendarNotes").value.trim(),
          }
        : event
    ));
    saveExternalCalendarEvents();
    return normalizeExternalCalendarEvent(crmExternalCalendarEvents.find((event) => event.eventKey === selectedEvent.eventKey));
  }
  return d2OriginalCaptureCalendarFormToFile();
};

if (typeof renderCalendar === "function") renderCalendar();
