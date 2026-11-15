import Insight from "./model.js";
import Lead from "../lead/model.js";
import CallResponse from "../response/model.js";
import { sendResponse } from "../../utils/sendResposeType.js";

// Helper to build date range condition strictly on response createdAt
const buildDateCondition = (startDate, endDate) => {
    if (!startDate && !endDate) return null;

    let startUtc, endUtc;
    if (startDate) {
        const cleanDate = startDate.split('T')[0];
        startUtc = new Date(`${cleanDate}T00:00:00.000Z`);
    }
    if (endDate) {
        const cleanDate = endDate.split('T')[0];
        endUtc = new Date(`${cleanDate}T23:59:59.999Z`);
    }

    const condition = {};
    if (startUtc) condition.$gte = startUtc;
    if (endUtc) condition.$lte = endUtc;

    return { createdAt: condition };
};

// ✅ GET INSIGHTS SUMMARY COUNTS (EVALUATES ONLY THE LATEST RESPONSE OF EACH LEAD BY OUTCOME, isDone, isMissed)
export const getInsights = async (req, res) => {
    try {
        const { passkey, startDate, endDate } = req.query;
        if (!passkey) {
            return sendResponse(res, 400, false, "Passkey is required");
        }

        const query = { passkey };
        const dateCond = buildDateCondition(startDate, endDate);
        if (dateCond) {
            query.createdAt = dateCond.createdAt;
        }

        // Fetch responses matching date range sorted newest first
        const responses = await CallResponse.find(query).sort({ createdAt: -1 });

        // Map to keep ONLY the single latest response for each lead
        const latestResponseMap = new Map();
        for (const resp of responses) {
            if (!resp.leadId) continue;
            const leadIdStr = resp.leadId.toString();
            if (!latestResponseMap.has(leadIdStr)) {
                latestResponseMap.set(leadIdStr, resp);
            }
        }

        let callbackMissed = 0;
        let callbackDone = 0;
        let meetingsMissed = 0;
        let meetingsDone = 0;
        let taskDone = 0;

        for (const resp of latestResponseMap.values()) {
            const outcome = (resp.outcome || '').toLowerCase();

            if (resp.isDone) {
                if (outcome.includes('deal') || outcome.includes('conversion')) {
                    taskDone++;
                } else if (outcome.includes('meeting')) {
                    meetingsDone++;
                } else if (outcome.includes('callback')) {
                    callbackDone++;
                } else {
                    taskDone++;
                }
            } else if (resp.isMissed) {
                if (outcome.includes('meeting')) {
                    meetingsMissed++;
                } else if (outcome.includes('callback')) {
                    callbackMissed++;
                } else {
                    callbackMissed++;
                }
            }
        }

        const summary = {
            callbackMissed,
            callbackDone,
            meetingsMissed,
            meetingsDone,
            taskDone,
            conversions: taskDone,
        };

        return sendResponse(res, 200, true, "Insights fetched successfully", summary);
    } catch (error) {
        console.error("Get Insights Error:", error);
        return sendResponse(res, 500, false, "Error fetching insights", null, error.message);
    }
};

// ✅ GET POPULATED LEADS FOR A SPECIFIC INSIGHT FOLDER (EVALUATES ONLY THE LATEST RESPONSE OF EACH LEAD)
export const getInsightLeads = async (req, res) => {
    try {
        const { passkey, category, startDate, endDate } = req.query;
        if (!passkey || !category) {
            return sendResponse(res, 400, false, "Passkey and category are required");
        }

        const query = { passkey };
        const dateCond = buildDateCondition(startDate, endDate);
        if (dateCond) {
            query.createdAt = dateCond.createdAt;
        }

        // Fetch responses matching date range sorted newest first
        const responses = await CallResponse.find(query).sort({ createdAt: -1 });

        // Map to keep ONLY the single latest response for each lead
        const latestResponseMap = new Map();
        for (const resp of responses) {
            if (!resp.leadId) continue;
            const leadIdStr = resp.leadId.toString();
            if (!latestResponseMap.has(leadIdStr)) {
                latestResponseMap.set(leadIdStr, resp);
            }
        }

        const matchedLeadIds = new Set();
        const catLower = category.toLowerCase();

        for (const [leadIdStr, resp] of latestResponseMap.entries()) {
            const outcome = (resp.outcome || '').toLowerCase();
            let isMatch = false;

            if (catLower === 'meetings_done') {
                isMatch = resp.isDone && outcome.includes('meeting');
            } else if (catLower === 'meetings_missed') {
                isMatch = resp.isMissed && outcome.includes('meeting');
            } else if (catLower === 'callback_done') {
                isMatch = resp.isDone && outcome.includes('callback');
            } else if (catLower === 'callback_missed') {
                isMatch = resp.isMissed && outcome.includes('callback');
            } else if (catLower === 'task_done' || catLower === 'conversions') {
                isMatch = (resp.isDone && !outcome.includes('meeting') && !outcome.includes('callback')) || outcome.includes('deal') || outcome.includes('conversion');
            }

            if (isMatch) {
                matchedLeadIds.add(leadIdStr);
            }
        }

        const leads = await Lead.find({ _id: { $in: Array.from(matchedLeadIds) } }).sort({ createdAt: -1 });

        return sendResponse(res, 200, true, "Insight folder leads fetched successfully", leads);
    } catch (error) {
        console.error("Get Insight Folder Leads Error:", error);
        return sendResponse(res, 500, false, "Error fetching insight folder leads", null, error.message);
    }
};
