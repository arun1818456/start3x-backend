import cron from "node-cron";
import CallResponse from "../modules/response/model.js";
import Lead from "../modules/lead/model.js";
import { notifyPasskeyUsersAndAdmins } from "../utils/sendPush.js";

/**
 * Parse scheduledDate strings like:
 * - "25/11/2026 02:30 PM" (DD/MM/YYYY hh:mm AM/PM in IST)
 * - "25/11/2026 2:30 PM"
 * - ISO date strings
 * Returns UTC Date adjusted from Asia/Kolkata (+05:30) when DD/MM/YYYY is used.
 */
const parseScheduledDateTimeIST = (text) => {
    if (!text || typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    const regex = /(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?)?/;
    const match = trimmed.match(regex);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);

        let hour = 9; // Default 9:00 AM IST if time missing
        let minute = 0;
        if (match[4] && match[5]) {
            hour = parseInt(match[4], 10);
            minute = parseInt(match[5], 10);
            const period = match[6]?.toUpperCase();
            if (period === "PM" && hour < 12) hour += 12;
            if (period === "AM" && hour === 12) hour = 0;
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            // Convert IST (+05:30) wall-clock to UTC timestamp
            const utcMs = Date.UTC(year, month - 1, day, hour, minute) - (5.5 * 60 * 60 * 1000);
            return new Date(utcMs);
        }
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Compute exact trigger Date for reminder option
 */
const getReminderTriggerTime = (dueDate, reminderStr) => {
    if (!dueDate) return null;
    if (!reminderStr || typeof reminderStr !== "string") return dueDate;

    const rem = reminderStr.trim();
    const remLower = rem.toLowerCase();

    if (remLower.startsWith("custom")) {
        const innerMatch = rem.match(/\(([^)]+)\)/);
        if (innerMatch && innerMatch[1]) {
            const customDt = parseScheduledDateTimeIST(innerMatch[1]);
            if (customDt) return customDt;
        }
        return dueDate;
    }

    const ms = dueDate.getTime();
    if (remLower.includes("30 minutes")) return new Date(ms - 30 * 60 * 1000);
    if (remLower.includes("1 hour")) return new Date(ms - 60 * 60 * 1000);
    if (remLower.includes("1 day")) return new Date(ms - 24 * 60 * 60 * 1000);
    if (remLower.includes("1 week")) return new Date(ms - 7 * 24 * 60 * 60 * 1000);

    return dueDate; // "At task due time"
};

// Runs every minute to dispatch scheduled callback/meeting reminders & missed task alerts
cron.schedule("* * * * *", async () => {
    try {
        const now = new Date();
        const nowMs = now.getTime();

        // Fetch pending responses that have scheduledDate and haven't finished both alerts
        const pendingResponses = await CallResponse.find({
            isDone: false,
            isMissed: false,
            scheduledDate: { $nin: [null, ""] },
            $or: [{ reminderSent: { $ne: true } }, { missedAlertSent: { $ne: true } }],
        })
            .sort({ createdAt: -1 })
            .limit(500);

        if (pendingResponses.length === 0) return;

        // Only evaluate the latest response per lead
        const latestByLead = new Map();
        for (const resp of pendingResponses) {
            if (!resp.leadId) continue;
            const leadKey = resp.leadId.toString();
            if (!latestByLead.has(leadKey)) {
                latestByLead.set(leadKey, resp);
            }
        }

        const leadIds = Array.from(latestByLead.keys());
        const leads = await Lead.find({ _id: { $in: leadIds } });
        const leadMap = new Map(leads.map((l) => [l._id.toString(), l]));

        for (const [leadIdStr, resp] of latestByLead.entries()) {
            const lead = leadMap.get(leadIdStr);
            if (!lead || lead.isCompleted) continue;

            const dueTime = parseScheduledDateTimeIST(resp.scheduledDate);
            if (!dueTime) continue;

            const dueMs = dueTime.getTime();
            const reminderTime = getReminderTriggerTime(dueTime, resp.reminder);
            const reminderMs = reminderTime ? reminderTime.getTime() : dueMs;

            const outcomeLower = (resp.outcome || "").toLowerCase();
            const isMeeting = outcomeLower.includes("meeting");
            const taskLabel = isMeeting ? "Meeting" : "Callback";

            // 1. Pre-reminder / Due-time reminder (within 15 min window after trigger time)
            if (
                !resp.reminderSent &&
                nowMs >= reminderMs &&
                nowMs <= Math.max(dueMs, reminderMs) + 15 * 60 * 1000
            ) {
                resp.reminderSent = true;
                await resp.save();

                await notifyPasskeyUsersAndAdmins({
                    passkey: resp.passkey,
                    includeAdmins: false,
                    title: `⏰ ${taskLabel} Reminder`,
                    body: `${taskLabel} with "${lead.name}" (${resp.scheduledDate})${resp.reminder ? ` • ${resp.reminder}` : ""}.`,
                    type: "task_reminder",
                    data: {
                        type: "task_reminder",
                        leadId: lead._id.toString(),
                        passkey: resp.passkey,
                    },
                });
            }

            // 2. Overdue / Missed alert (15 minutes past due time, within 24 hours so ancient items aren't blasted)
            const fifteenMinAfterDue = dueMs + 15 * 60 * 1000;
            const twentyFourHoursAfterDue = dueMs + 24 * 60 * 60 * 1000;

            if (
                !resp.missedAlertSent &&
                nowMs >= fifteenMinAfterDue &&
                nowMs <= twentyFourHoursAfterDue
            ) {
                resp.missedAlertSent = true;
                await resp.save();

                await notifyPasskeyUsersAndAdmins({
                    passkey: resp.passkey,
                    includeAdmins: true,
                    title: `⚠️ Missed ${taskLabel} Alert`,
                    body: `${taskLabel} for "${lead.name}" (${resp.scheduledDate}) is overdue and still pending.`,
                    type: "task_missed",
                    data: {
                        type: "task_missed",
                        leadId: lead._id.toString(),
                        passkey: resp.passkey,
                    },
                });
            }
        }
    } catch (err) {
        console.error("🔥 Error in reminderCron:", err);
    }
}, {
    timezone: "Asia/Kolkata",
});
