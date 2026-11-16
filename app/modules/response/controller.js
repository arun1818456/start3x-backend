import CallResponse from "./model.js";
import Lead from "../lead/model.js";
import User from "../user/model.js";
import { sendResponse } from "../../utils/sendResposeType.js";
import { sendMultipleNotificationToUsers } from "../../utils/sendPush.js";

// ✅ CREATE CALL RESPONSE (STORES IN RESPONSES COLLECTION & LINKS TO LEAD BY LEAD ID)
export const createResponse = async (req, res) => {
    try {
        console.log("📥 Create Call Response Request:", req.body);
        let {
            passkey,
            leadId,
            outcome,
            scheduledDate,
            text,
            reminder,
            isDone,
            isMissed,
            userName,
            callerName,
            userId,
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

        const resolvedCallerName = userName || callerName || req.user?.name || (req.user?.role === 'admin' ? 'Admin' : null);

        // Count existing responses for this lead / passkey
        const totalResponses = await CallResponse.countDocuments({
            passkey,
            leadId: leadDoc._id,
        });

        // Create the response in the shared responses collection.
        const newResponse = await CallResponse.create({
            passkey,
            leadId: leadDoc._id,
            userId: userId || req.user?._id || null,
            userName: resolvedCallerName,
            callerName: resolvedCallerName,
            responseNumber: `Response #${totalResponses + 1}`,
            outcome,
            scheduledDate: scheduledDate || null,
            text: text || '',
            reminder: reminder || null,
            isDone: isDone || false,
            isMissed: isMissed || false,
        });
       updateLeadStatus(leadDoc._id); // Update lead status based on the latest response

        // 🔥 Send push notification to team members with same passkey
        try {
            const users = await User.find({
                passkey: newResponse.passkey,
                deviceToken: { $exists: true, $ne: "" },
            });
            const currentUserId = (userId || req.user?._id || '').toString();
            const tokens = users
                .filter(u => u._id.toString() !== currentUserId)
                .map(u => u.deviceToken)
                .filter(Boolean);

            if (tokens.length > 0) {
                const title = outcome === 'Got a meeting'
                    ? "📅 Meeting Scheduled!"
                    : `📞 Lead Update: ${outcome}`;
                const body = `${resolvedCallerName || 'Team member'} updated lead "${leadDoc.name}" (${outcome}).`;
                sendMultipleNotificationToUsers(
                    tokens,
                    title,
                    body,
                    {
                        type: "response_added",
                        leadId: leadDoc._id.toString(),
                        passkey: newResponse.passkey,
                    }
                );
            }
        } catch (pushErr) {
            console.error("Push notification error in createResponse:", pushErr.message);
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
        const { passkey, leadId, phoneNumber, startDate, endDate, userId, userName } = req.query;

        const filter = {};
        if (leadId) {
            filter.leadId = leadId;
        }
        if (userId) {
            filter.userId = userId;
        }
        if (userName) {
            filter.userName = userName;
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

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                const cleanDate = startDate.split('T')[0];
                filter.createdAt.$gte = new Date(`${cleanDate}T00:00:00.000Z`);
            }
            if (endDate) {
                const cleanDate = endDate.split('T')[0];
                filter.createdAt.$lte = new Date(`${cleanDate}T23:59:59.999Z`);
            }
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
        const { outcome, scheduledDate, text, reminder, isDone } = req.body || {};

        const responseDoc = await CallResponse.findById(id);
        if (!responseDoc) {
            return sendResponse(res, 404, false, "Call response not found");
        }

        if (outcome !== undefined) responseDoc.outcome = outcome;
        if (scheduledDate !== undefined) responseDoc.scheduledDate = scheduledDate;
        if (text !== undefined) responseDoc.text = text;
        if (reminder !== undefined) responseDoc.reminder = reminder;
        if (isDone !== undefined) responseDoc.isDone = isDone;

        await responseDoc.save();
        updateLeadStatus(responseDoc.leadId); // Update lead status based on the latest response
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


//// common method for updating lead status based on last  response 
const updateLeadStatus = async (leadId) => {
    try {
        const lastResponse = await CallResponse.findOne({ leadId }).
sort({ createdAt: -1 });
        if (lastResponse) {
            const leadDoc = await Lead.findById(leadId
);            if (leadDoc) {
                if (lastResponse.isDone === true) {
                    leadDoc.status = 'Done Task:';
                    leadDoc.isCompleted = true;
                } else if (lastResponse.isMissed === true) {
                    leadDoc.status = 'Missed Task:';
                    leadDoc.isCompleted = true;
                } else {
                    leadDoc.status = 'To-do:';
                    leadDoc.isCompleted = false;
                }
                leadDoc.scheduledDate = lastResponse.scheduledDate || null;
                await leadDoc.save();
            }
        }
    } catch (error) {
        console.error("Update Lead Status Error:", error);
    }
};
