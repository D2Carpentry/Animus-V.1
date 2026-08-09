const DRIVE_PARENT_FOLDER_ID = "1XhGOeZFdBnYnoMxc5UIJCTd0-IUZCtkJ";
const CRM_SHEET_NAME = "D2 Dashboard Database";
const D2_CALENDAR_NAME = "D2 Carpentry";
const D2_CALENDAR_ALTERNATE_NAMES = ["d2carpentryanddesign@gmail.com", "D2 Schedule", "D2 Carpentry & Design"];

const SHEETS = {
  files: "Files",
  revenue: "Revenue",
  prices: "Price Database",
  submissions: "Estimate Submissions",
};

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const parentFolder = DriveApp.getFolderById(DRIVE_PARENT_FOLDER_ID);
    const spreadsheet = getOrCreateDatabase_(parentFolder);
    const action = String(payload.action || "estimateSubmit");

    if (action === "dashboardSync") {
      return jsonResponse_(saveDashboardSync_(payload, parentFolder, spreadsheet));
    }

    if (action === "calendarEvent") {
      return jsonResponse_(upsertCalendarEvent_(payload.calendarEvent || {}));
    }

    return jsonResponse_(saveEstimateSubmission_(payload, parentFolder, spreadsheet));
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || "");
    if (action === "dashboardData") {
      const parentFolder = DriveApp.getFolderById(DRIVE_PARENT_FOLDER_ID);
      const dashboard = loadLatestDashboardSync_(parentFolder);
      const response = { ok: true, action: "dashboardData", dashboard };
      const callback = String(e.parameter.callback || "").trim();
      if (callback) return javascriptResponse_(callback, response);
      return jsonResponse_(response);
    }
    if (action === "calendarEvents") {
      const events = listCalendarEvents_(e.parameter || {});
      const response = { ok: true, action: "calendarEvents", events };
      const callback = String(e.parameter.callback || "").trim();
      if (callback) return javascriptResponse_(callback, response);
      return jsonResponse_(response);
    }
    return ContentService
      .createTextOutput("D2 Dashboard Google Drive connection is live.")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    const response = { ok: false, error: String(error && error.message ? error.message : error) };
    const callback = String(e && e.parameter && e.parameter.callback || "").trim();
    if (callback) return javascriptResponse_(callback, response);
    return jsonResponse_(response);
  }
}

function saveDashboardSync_(payload, parentFolder, spreadsheet) {
  const files = Array.isArray(payload.dashboardFiles) ? payload.dashboardFiles : [];
  const revenueRows = Array.isArray(payload.revenueRows) ? payload.revenueRows : [];
  const priceRows = Array.isArray(payload.priceRows) ? payload.priceRows : [];
  const backupFolder = getOrCreateChildFolder_(parentFolder, "00 Dashboard Backups");
  const backupStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH-mm-ss");
  const dashboardPayload = JSON.stringify(payload, null, 2);

  upsertTextFile_(
    parentFolder,
    "D2 Dashboard Sync - latest.json",
    dashboardPayload,
    MimeType.PLAIN_TEXT
  );
  backupFolder.createFile(`D2 Dashboard Sync - ${backupStamp}.json`, dashboardPayload, MimeType.PLAIN_TEXT);

  const fileSheet = getSheet_(spreadsheet, SHEETS.files, fileHeaders_());
  replaceRows_(fileSheet, fileHeaders_(), files.map((file) => {
    const folder = getOrCreateCustomerFolder_(parentFolder, file);
    createStandardSubfolders_(folder);
    upsertTextFile_(folder, "Dashboard File.json", JSON.stringify(file, null, 2), MimeType.PLAIN_TEXT);
    return fileRow_(file, folder.getUrl());
  }));

  const revenueSheet = getSheet_(spreadsheet, SHEETS.revenue, revenueHeaders_());
  replaceRows_(revenueSheet, revenueHeaders_(), revenueRows.map(revenueRow_));

  const priceSheet = getSheet_(spreadsheet, SHEETS.prices, priceHeaders_());
  replaceRows_(priceSheet, priceHeaders_(), priceRows.map(priceRow_));

  return {
    ok: true,
    action: "dashboardSync",
    fileCount: files.length,
    revenueCount: revenueRows.length,
    priceCount: priceRows.length,
    databaseUrl: spreadsheet.getUrl(),
    driveUrl: parentFolder.getUrl(),
  };
}

function loadLatestDashboardSync_(parentFolder) {
  const files = parentFolder.getFilesByName("D2 Dashboard Sync - latest.json");
  if (!files.hasNext()) return null;
  const text = files.next().getBlob().getDataAsString();
  return text ? JSON.parse(text) : null;
}

function upsertCalendarEvent_(event) {
  const calendar = getOrCreateCalendar_();
  const key = String(event.eventKey || "").trim();
  if (!key) throw new Error("Missing calendar event key.");
  const start = event.startIso ? new Date(event.startIso) : new Date(`${event.date}T${event.time || "09:00"}`);
  if (Number.isNaN(start.getTime())) throw new Error("Missing calendar event date.");
  const end = event.endIso ? new Date(event.endIso) : new Date(start.getTime() + 60 * 60 * 1000);
  const marker = `D2_EVENT_KEY:${key}`;
  const description = [
    event.notes || "",
    "",
    marker,
  ].join("\n").trim();
  const searchStart = new Date(start.getFullYear() - 1, 0, 1);
  const searchEnd = new Date(start.getFullYear() + 2, 11, 31);
  const existing = calendar.getEvents(searchStart, searchEnd, { search: marker })[0];
  if (existing) {
    existing.setTitle(event.title || "D2 Calendar Event");
    existing.setTime(start, end);
    existing.setDescription(description);
    if (event.address) existing.setLocation(event.address);
    return {
      ok: true,
      action: "calendarEvent",
      mode: "updated",
      eventKey: key,
      eventId: existing.getId(),
    };
  }
  const created = calendar.createEvent(event.title || "D2 Calendar Event", start, end, {
    description,
    location: event.address || "",
  });
  created.addPopupReminder(60);
  return {
    ok: true,
    action: "calendarEvent",
    mode: "created",
    eventKey: key,
    eventId: created.getId(),
  };
}

function getOrCreateCalendar_() {
  const calendars = CalendarApp.getCalendarsByName(D2_CALENDAR_NAME);
  if (calendars.length) return calendars[0];
  return CalendarApp.createCalendar(D2_CALENDAR_NAME);
}

function listCalendarEvents_(params) {
  const calendars = getD2Calendars_();
  const now = new Date();
  const fallbackStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fallbackEnd = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0);
  const start = params.start ? new Date(`${params.start}T00:00:00`) : fallbackStart;
  const end = params.end ? new Date(`${params.end}T23:59:59`) : fallbackEnd;
  const timezone = Session.getScriptTimeZone();
  return calendars.reduce((rows, calendar) => {
    calendar.getEvents(start, end).forEach((event) => {
      const eventStart = event.getStartTime();
      const eventEnd = event.getEndTime();
      const description = event.getDescription() || "";
      const keyMatch = description.match(/D2_EVENT_KEY:([^\s]+)/);
      rows.push({
        eventId: event.getId(),
        eventKey: keyMatch ? keyMatch[1] : `google-${event.getId()}`,
        title: event.getTitle(),
        date: Utilities.formatDate(eventStart, timezone, "yyyy-MM-dd"),
        time: Utilities.formatDate(eventStart, timezone, "HH:mm"),
        startIso: eventStart.toISOString(),
        endIso: eventEnd.toISOString(),
        address: event.getLocation() || "",
        calendarName: calendar.getName(),
        description,
        notes: description,
      });
    });
    return rows;
  }, []);
}

function getD2Calendars_() {
  const names = [D2_CALENDAR_NAME].concat(D2_CALENDAR_ALTERNATE_NAMES);
  const calendars = [];
  const seen = {};
  names.forEach((name) => {
    CalendarApp.getCalendarsByName(name).forEach((calendar) => {
      if (seen[calendar.getId()]) return;
      seen[calendar.getId()] = true;
      calendars.push(calendar);
    });
  });
  return calendars.length ? calendars : [getOrCreateCalendar_()];
}

function javascriptResponse_(callback, payload) {
  const safeCallback = callback.replace(/[^A-Za-z0-9_$.[\\]]/g, "");
  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function saveEstimateSubmission_(payload, parentFolder, spreadsheet) {
  const file = estimatePayloadToFile_(payload);
  const customerFolder = getOrCreateCustomerFolder_(parentFolder, file);
  createStandardSubfolders_(customerFolder);

  upsertTextFile_(
    customerFolder,
    `${cleanName_(file.fileNumber)} - editable-estimate.d2estimate`,
    JSON.stringify(payload, null, 2),
    MimeType.PLAIN_TEXT
  );

  const copies = payload.copies || {};
  Object.keys(copies).forEach((key) => {
    const copy = copies[key] || {};
    if (!copy.html) return;
    upsertTextFile_(
      customerFolder,
      `${cleanName_(file.fileNumber)} - ${cleanName_(copy.label || key)}.html`,
      copy.html,
      MimeType.HTML
    );
  });

  const submissionSheet = getSheet_(spreadsheet, SHEETS.submissions, submissionHeaders_());
  upsertRowByKey_(submissionSheet, submissionHeaders_(), file.fileNumber, submissionRow_(payload, customerFolder.getUrl()));

  const fileSheet = getSheet_(spreadsheet, SHEETS.files, fileHeaders_());
  upsertRowByKey_(fileSheet, fileHeaders_(), file.fileNumber, fileRow_(file, customerFolder.getUrl()));

  return {
    ok: true,
    action: "estimateSubmit",
    fileNumber: file.fileNumber,
    folderUrl: customerFolder.getUrl(),
    databaseUrl: spreadsheet.getUrl(),
  };
}

function estimatePayloadToFile_(payload) {
  const totals = payload.totals || {};
  const backend = payload.backend || {};
  return {
    fileNumber: payload.estimateNumber || `D2-${Date.now()}`,
    clientName: payload.clientName || "Unnamed Client",
    clientPhone: payload.clientPhone || "",
    clientEmail: payload.clientEmail || "",
    projectAddress: payload.projectAddress || "",
    leadSource: payload.leadSource || "Manual",
    projectType: payload.projectType || "Other",
    fileStatus: payload.fileStatus || "Inspection Completed",
    statusDetail: payload.statusDetail || "Estimate Pending",
    estimateTotal: Number(totals.total) || 0,
    materialTotal: Number(backend.estimatedMaterialCost) || 0,
    initialDeposit: "",
    midpointDeposit: "",
    finalPaymentAmount: "",
    paidInFull: payload.invoicePaid === true ? "Yes" : "No",
    nextAction: payload.nextAction || "",
    nextActionDate: payload.nextActionDate || "",
  };
}

function getOrCreateDatabase_(parentFolder) {
  const files = parentFolder.getFilesByName(CRM_SHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());

  const spreadsheet = SpreadsheetApp.create(CRM_SHEET_NAME);
  const file = DriveApp.getFileById(spreadsheet.getId());
  parentFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  getSheet_(spreadsheet, SHEETS.files, fileHeaders_());
  getSheet_(spreadsheet, SHEETS.revenue, revenueHeaders_());
  getSheet_(spreadsheet, SHEETS.prices, priceHeaders_());
  getSheet_(spreadsheet, SHEETS.submissions, submissionHeaders_());
  return spreadsheet;
}

function getSheet_(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  ensureHeader_(sheet, headers);
  return sheet;
}

function ensureHeader_(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some((value) => String(value || "").trim());
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  headers.forEach((header, index) => {
    if (firstRow[index] !== header) sheet.getRange(1, index + 1).setValue(header);
  });
}

function replaceRows_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);
}

function upsertRowByKey_(sheet, headers, key, row) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let index = 0; index < keys.length; index += 1) {
      if (String(keys[index][0]) === String(key)) {
        sheet.getRange(index + 2, 1, 1, headers.length).setValues([row]);
        return;
      }
    }
  }
  sheet.appendRow(row);
}

function getOrCreateCustomerFolder_(parentFolder, file) {
  const fileNumber = cleanName_(file.fileNumber || `D2-${Date.now()}`);
  const clientName = cleanName_(file.clientName || "Unnamed Client");
  return getOrCreateChildFolder_(parentFolder, `${fileNumber} - ${clientName}`);
}

function createStandardSubfolders_(customerFolder) {
  [
    "01 Estimates",
    "02 Photos",
    "03 Assignments",
    "04 Invoices and Payments",
    "05 Materials and Receipts",
    "06 Warranty",
  ].forEach((name) => getOrCreateChildFolder_(customerFolder, name));
}

function getOrCreateChildFolder_(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(name);
}

function upsertTextFile_(folder, name, content, mimeType) {
  const files = folder.getFilesByName(name);
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
    return file;
  }
  return folder.createFile(name, content, mimeType);
}

function parsePayload_(e) {
  const directPayload = e && e.parameter && e.parameter.payload;
  if (directPayload) return JSON.parse(directPayload);
  const body = e && e.postData && e.postData.contents;
  return body ? JSON.parse(body) : {};
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanName_(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function fileHeaders_() {
  return [
    "Updated At",
    "File No.",
    "Client",
    "Phone",
    "Email",
    "Address",
    "Lead Source",
    "Project Type",
    "File Status",
    "Status Detail",
    "Estimate Amount",
    "Materials",
    "1st Deposit",
    "2nd Deposit",
    "Final Payment",
    "Paid In Full",
    "Next Action",
    "Next Action Date",
    "Drive Folder",
  ];
}

function fileRow_(file, folderUrl) {
  return [
    new Date(),
    file.fileNumber || "",
    file.clientName || "",
    file.clientPhone || "",
    file.clientEmail || "",
    file.projectAddress || "",
    file.leadSource || "",
    file.projectType || "",
    file.fileStatus || "",
    file.statusDetail || "",
    Number(file.estimateTotal) || 0,
    Number(file.materialTotal) || 0,
    Number(file.initialDeposit) || 0,
    Number(file.midpointDeposit) || 0,
    Number(file.finalPaymentAmount) || 0,
    file.paidInFull || "",
    file.nextAction || "",
    file.nextActionDate || "",
    folderUrl || "",
  ];
}

function revenueHeaders_() {
  return ["Updated At", "Date", "Client / Job", "Gross", "Expenses", "Labor", "Profit", "Receipt Notes", "Labor Assigns", "Dashboard File ID"];
}

function revenueRow_(row) {
  const gross = Number(row.gross) || 0;
  const expenses = Number(row.expenses) || 0;
  const labor = Number(row.labor) || 0;
  return [
    new Date(),
    row.date || "",
    row.clientJob || "",
    gross,
    expenses,
    labor,
    Number(row.profit) || gross - expenses - labor,
    row.receiptNotes || "",
    row.laborAssigns || "",
    row.dashboardFileId || "",
  ];
}

function priceHeaders_() {
  return ["Updated At", "Product", "Price", "Unit", "Category", "Vendor", "Source", "Source ID"];
}

function priceRow_(row) {
  return [
    new Date(),
    row.name || row.product || "",
    Number(row.defaultPrice || row.price) || 0,
    row.unit || "",
    row.category || "",
    row.vendor || "",
    row.source || "",
    row.sourceId || row.id || "",
  ];
}

function submissionHeaders_() {
  return ["Updated At", "File No.", "Client", "Phone", "Email", "Address", "Project Type", "Estimate Total", "Material Cost", "Submitted At", "Drive Folder"];
}

function submissionRow_(payload, folderUrl) {
  const totals = payload.totals || {};
  const backend = payload.backend || {};
  return [
    new Date(),
    payload.estimateNumber || "",
    payload.clientName || "",
    payload.clientPhone || "",
    payload.clientEmail || "",
    payload.projectAddress || "",
    payload.projectType || "",
    Number(totals.total) || 0,
    Number(backend.estimatedMaterialCost) || 0,
    payload.submittedAt || "",
    folderUrl || "",
  ];
}
