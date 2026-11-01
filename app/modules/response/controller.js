import CallResponse from "./model.js";
import Lead from "../lead/model.js";
import { sendResponse } from "../../utils/sendResposeType.js";

// ✅ CREATE CALL RESPONSE (STORES IN RESPONSES COLLECTION & LINKS TO LEAD BY LEAD ID)
export const createResponse = async (req, res) => {
    try {
        console.log("📥 Create Call Response Request:", req.body);
        let {
            passkey,
            leadId,
            outcome,
            meetingScheduled,
            text,
            reminder,
        } = req.body || {};

        if (!outcome) {
            return sendResponse(res, 400, false, "Outcome is required");
        }

        let leadDoc = null;
        if (leadId) {
            leadDoc = await Lead.findById(leadId);
        }

        if (!leadDoc) {
            return sendResponse(res, 404, false, "Lead not found");
        }

        passkey = leadDoc.passkey;

        // Count existing responses for this lead / passkey
        const totalResponses = await CallResponse.countDocuments({
            passkey,
            leadId: leadDoc._id,
        });

        // Create the response in the shared responses collection.
        const newResponse = await CallResponse.create({
            passkey,
            leadId: leadDoc._id,
            responseNumber: `Response #${totalResponses + 1}`,
            outcome,
            meetingScheduled: meetingScheduled || null,
            text: text || '',
            reminder: reminder || null,
        });

        if (leadDoc) {
            if (outcome === 'Got a meeting' || outcome === 'Got a callback') {
                leadDoc.status = 'Done Task:';
            }
            await leadDoc.save();
        }

        return sendResponse(res, 200, true, "Call response added successfully", newResponse);
    } catch (error) {
        console.error("Create Call Response Error:", error);
        return sendResponse(res, 500, false, "Error creating call response", null, error.message);
    }
};

// ✅ GET RESPONSES BY LEAD ID, PASSKEY, OR PHONE NUMBER
export const getResponses = async (req, res) => {
    try {
        const { passkey, leadId, phoneNumber } = req.query;

        const filter = {};
        if (leadId) {
            filter.leadId = leadId;
        }

        if (!passkey && !phoneNumber && !leadId) {
            return sendResponse(res, 400, false, "At least passkey, leadId, or phoneNumber is required to fetch responses");
        }

        if (passkey) filter.passkey = passkey;
        if (phoneNumber && !leadId) {
            const matchingLeads = await Lead.find(
                { phoneNumber, ...(passkey ? { passkey } : {}) },
                { _id: 1 },
            );
            filter.leadId = { $in: matchingLeads.map((lead) => lead._id) };
        }

        const responses = await CallResponse.find(filter).sort({ createdAt: -1 });
        return sendResponse(res, 200, true, "Call responses fetched successfully", responses);
    } catch (error) {
        console.error("Get Call Responses Error:", error);
        return sendResponse(res, 500, false, "Error fetching call responses", null, error.message);
    }
};

// ✅ UPDATE CALL RESPONSE
export const updateResponse = async (req, res) => {
    try {
        const { id } = req.params;
        const { outcome, meetingScheduled, text, reminder } = req.body || {};

        const responseDoc = await CallResponse.findById(id);
        if (!responseDoc) {
            return sendResponse(res, 404, false, "Call response not found");
        }

        if (outcome !== undefined) responseDoc.outcome = outcome;
        if (meetingScheduled !== undefined) responseDoc.meetingScheduled = meetingScheduled;
        if (text !== undefined) responseDoc.text = text;
        if (reminder !== undefined) responseDoc.reminder = reminder;

        await responseDoc.save();

        return sendResponse(res, 200, true, "Call response updated successfully", responseDoc);
    } catch (error) {
        console.error("Update Call Response Error:", error);
        return sendResponse(res, 500, false, "Error updating call response", null, error.message);
    }
};

// ✅ DELETE CALL RESPONSE
export const deleteResponse = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await CallResponse.findByIdAndDelete(id);
        if (!deleted) {
            return sendResponse(res, 404, false, "Call response not found");
        }

        return sendResponse(res, 200, true, "Call response deleted successfully", deleted);
    } catch (error) {
        console.error("Delete Call Response Error:", error);
        return sendResponse(res, 500, false, "Error deleting call response", null, error.message);
    }
};
