import Insight from "./model.js";
import Lead from "../lead/model.js";
import CallResponse from "../response/model.js";
import { sendResponse } from "../../utils/sendResposeType.js";

// ✅ GET INSIGHTS SUMMARY COUNTS
export const getInsights = async (req, res) => {
    try {
        const { passkey } = req.query;
        if (!passkey) {
            return sendResponse(res, 400, false, "Passkey is required");
        }

        const responses = await CallResponse.find({ passkey });

        let callbackMissed = 0;
        let callbackDone = 0;
        let meetingsMissed = 0;
        let meetingsDone = 0;
        let taskDone = 0;

        for (const resp of responses) {
            const outcome = (resp.outcome || '').toLowerCase();
            const text = (resp.text || '').toLowerCase();

            if (resp.isDone) {
                if (outcome.includes('callback') || text.includes('callback')) {
                    callbackDone++;
                } else if (outcome.includes('meeting') || text.includes('meeting')) {
                    meetingsDone++;
                } else {
                    taskDone++;
                }
            } else if (resp.isMissed) {
                if (outcome.includes('callback') || text.includes('callback')) {
                    callbackMissed++;
                } else if (outcome.includes('meeting') || text.includes('meeting')) {
                    meetingsMissed++;
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

// ✅ GET POPULATED LEADS FOR A SPECIFIC INSIGHT FOLDER/CATEGORY
export const getInsightLeads = async (req, res) => {
    try {
        const { passkey, category } = req.query;
        if (!passkey || !category) {
            return sendResponse(res, 400, false, "Passkey and category are required");
        }

        const responses = await CallResponse.find({ passkey });
        const leadIds = new Set();

        for (const resp of responses) {
            const outcome = (resp.outcome || '').toLowerCase();
            const text = (resp.text || '').toLowerCase();
            let isMatch = false;

            if (category === 'meetings_done') {
                isMatch = resp.isDone && (outcome.includes('meeting') || text.includes('completed'));
            } else if (category === 'meetings_missed') {
                isMatch = resp.isMissed && (outcome.includes('meeting') || text.includes('missed'));
            } else if (category === 'callback_done') {
                isMatch = resp.isDone && outcome.includes('callback');
            } else if (category === 'callback_missed') {
                isMatch = resp.isMissed && outcome.includes('callback');
            } else if (category === 'task_done') {
                isMatch = resp.isDone;
            }

            if (isMatch && resp.leadId) {
                leadIds.add(resp.leadId.toString());
            }
        }

        const leads = await Lead.find({ _id: { $in: Array.from(leadIds) } });

        return sendResponse(res, 200, true, "Insight folder leads fetched successfully", leads);
    } catch (error) {
        console.error("Get Insight Folder Leads Error:", error);
        return sendResponse(res, 500, false, "Error fetching insight folder leads", null, error.message);
    }
};
