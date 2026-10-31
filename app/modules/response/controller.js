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
            phoneNumber,
            outcome,
            meetingScheduled,
            callback,
            text,
            callDate,
        } = req.body || {};

        if (!outcome) {
            return sendResponse(res, 400, false, "Outcome is required");
        }

        let leadDoc = null;
        if (leadId) {
            try {
                leadDoc = await Lead.findById(leadId);
                if (leadDoc) {
                    if (!passkey && leadDoc.passkey) passkey = leadDoc.passkey;
                    if (!phoneNumber && leadDoc.phoneNumber) phoneNumber = leadDoc.phoneNumber;
                }
            } catch (e) {
                console.error("Error looking up lead for passkey:", e);
            }
        }

        passkey = passkey || req.user?.passkey || 'default';

        if (!leadDoc && !leadId) {
            return sendResponse(res, 400, false, "Lead ID or valid Lead reference is required");
        }

        // Count existing responses for this lead / passkey
        const queryFilter = { passkey };
        if (leadId) queryFilter.leadId = leadId;

        const totalResponses = await CallResponse.countDocuments(queryFilter);

        // 1. Create CallResponse in CallResponse Collection
        const newResponse = await CallResponse.create({
            passkey,
            leadId: leadId || leadDoc?._id,
            phoneNumber: phoneNumber || '',
            responseNumber: `Response #${totalResponses + 1}`,
            outcome,
            meetingScheduled: meetingScheduled || null,
            callback: callback || null,
            text: text || '',
            callDate: callDate || new Date().toLocaleString(),
        });

        // 2. Add CallResponse ObjectId reference to Lead's responses array
        if (leadDoc) {
            leadDoc.responses.unshift(newResponse._id);
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
        } else if (passkey && phoneNumber) {
            filter.passkey = passkey;
            filter.phoneNumber = phoneNumber;
        } else if (passkey) {
            filter.passkey = passkey;
        } else if (phoneNumber) {
            filter.phoneNumber = phoneNumber;
        }

        if (!passkey && !phoneNumber && !leadId) {
            return sendResponse(res, 400, false, "At least passkey, leadId, or phoneNumber is required to fetch responses");
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
        const { outcome, meetingScheduled, callback, text, callDate } = req.body || {};

        const responseDoc = await CallResponse.findById(id);
        if (!responseDoc) {
            return sendResponse(res, 404, false, "Call response not found");
        }

        if (outcome !== undefined) responseDoc.outcome = outcome;
        if (meetingScheduled !== undefined) responseDoc.meetingScheduled = meetingScheduled;
        if (callback !== undefined) responseDoc.callback = callback;
        if (text !== undefined) responseDoc.text = text;
        if (callDate !== undefined) responseDoc.callDate = callDate;

        await responseDoc.save();

        return sendResponse(res, 200, true, "Call response updated successfully", responseDoc);
    } catch (error) {
        console.error("Update Call Response Error:", error);
        return sendResponse(res, 500, false, "Error updating call response", null, error.message);
    }
};

// ✅ DELETE CALL RESPONSE (REMOVES FROM RESPONSES COLLECTION & LEAD REFERENCE)
export const deleteResponse = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await CallResponse.findByIdAndDelete(id);
        if (!deleted) {
            return sendResponse(res, 404, false, "Call response not found");
        }

        // Remove ObjectId reference from Lead.responses array
        if (deleted.leadId) {
            try {
                await Lead.findByIdAndUpdate(deleted.leadId, {
                    $pull: { responses: deleted._id }
                });
            } catch (e) {
                console.error("Error pulling response reference from Lead:", e);
            }
        }

        return sendResponse(res, 200, true, "Call response deleted successfully", deleted);
    } catch (error) {
        console.error("Delete Call Response Error:", error);
        return sendResponse(res, 500, false, "Error deleting call response", null, error.message);
    }
};
