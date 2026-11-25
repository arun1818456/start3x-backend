import Lead from "./model.js";
import CallResponse from "../response/model.js";
import { sendResponse } from "../../utils/sendResposeType.js";
import { notifyPasskeyUsersAndAdmins } from "../../utils/sendPush.js";

// ✅ CREATE LEAD / ASSIGN LEAD TO PASSKEY
export const createLead = async (req, res) => {
    try {
        console.log("📥 Create Lead Request:", req.body);
        const {
            passkey,
            name,
            location,
            scheduledDate,
            phoneNumber,
            kw,
            electricityBill,
            textNote,
        } = req.body || {};

        if (!passkey || !name) {
            return sendResponse(res, 400, false, "Passkey and Lead Name are required");
        }

        const totalLeads = await Lead.countDocuments({ passkey });

        const newLead = await Lead.create({
            passkey,
            name,
            rank: `#${totalLeads + 1}`,
            location: location || '',
            scheduledDate: scheduledDate ,
            phoneNumber: phoneNumber || '',
            kw: kw || '',
            electricityBill: electricityBill || '',
        });

        const callerName = req.body?.userName || req.body?.callerName || req.user?.name || (req.user?.role === 'admin' ? 'Admin' : 'System');
        try {
            await CallResponse.create({
                passkey: newLead.passkey,
                leadId: newLead._id,
                responseNumber: 'Response #1',
                outcome: 'Got a meeting',
                scheduledDate: newLead.scheduledDate || null,
                text: textNote  || '',
                reminder: null,
                userName: callerName,
                callerName: callerName,
            });
        } catch (error) {
            try {
                await Lead.findByIdAndDelete(newLead._id);
            } catch (cleanupError) {
                console.error("Create Lead Rollback Error:", cleanupError);
            }
            throw error;
        }

        // 🔥 Send push notification to all users belonging to this passkey
        notifyPasskeyUsersAndAdmins({
            passkey: newLead.passkey,
            includePasskeyUsers: true,
            includeAdmins: false,
            excludeUserId: req.user?._id || "",
            title: "🎯 New Lead Assigned!",
            body: `Lead "${newLead.name}" has been assigned to your team.`,
            type: "lead_assigned",
            data: {
                type: "lead_assigned",
                leadId: newLead._id.toString(),
                passkey: newLead.passkey,
            },
        });

        return sendResponse(res, 200, true, "Lead assigned successfully", newLead);
    } catch (error) {
        console.error("Create Lead Error:", error);
        return sendResponse(res, 500, false, "Error creating lead", null, error.message);
    }
};

// ✅ GET LEADS BY PASSKEY (POPULATES RESPONSES FROM SEPARATE COLLECTION)
export const getLeads = async (req, res) => {
    try {
        const { passkey } = req.query;
        const targetPasskey = passkey || req.user?.passkey;

        if (!targetPasskey) {
            return sendResponse(res, 400, false, "Passkey is required to fetch leads");
        }

        const leads = await Lead.find({ passkey: targetPasskey })
            .sort({ createdAt: -1 });

        return sendResponse(res, 200, true, "Leads fetched successfully", leads);
    } catch (error) {
        console.error("Get Leads Error:", error);
        return sendResponse(res, 500, false, "Error fetching leads", null, error.message);
    }
};

// ✅ UPDATE LEAD / ADD CALL RESPONSE
export const updateLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, name, location, company, phoneNumber, altPhoneNumber, kw, electricityBill, textNote, scheduledDate, isCompleted } = req.body || {};

        const lead = await Lead.findById(id);
        if (!lead) {
            return sendResponse(res, 404, false, "Lead not found");
        }

        const hasDetailsChange =
            name !== undefined ||
            location !== undefined ||
            phoneNumber !== undefined ||
            altPhoneNumber !== undefined ||
            kw !== undefined ||
            electricityBill !== undefined ||
            scheduledDate !== undefined;

        if (status !== undefined) lead.status = status;
        if (name !== undefined) lead.name = name;
        if (location !== undefined) lead.location = location;
        if (company !== undefined) lead.company = company;
        if (phoneNumber !== undefined) lead.phoneNumber = phoneNumber;
        if (altPhoneNumber !== undefined) lead.altPhoneNumber = altPhoneNumber;
        if (kw !== undefined) lead.kw = kw;
        if (electricityBill !== undefined) lead.electricityBill = electricityBill;
        if (textNote !== undefined) lead.textNote = textNote;
        if (scheduledDate !== undefined) lead.scheduledDate = scheduledDate;
        if (isCompleted !== undefined) lead.isCompleted = isCompleted;
        await lead.save();
        try {
            await lead.populate({ path: 'responses', options: { sort: { createdAt: -1 } } });
        } catch (e) {
            console.warn("Could not populate responses in updateLead:", e.message);
        }

        // 🔥 Notify team + admins when lead details are updated (avoid duplicate push during Deal Closed status-only sync)
        if (hasDetailsChange) {
            notifyPasskeyUsersAndAdmins({
                passkey: lead.passkey,
                includePasskeyUsers: true,
                includeAdmins: true,
                excludeUserId: req.user?._id || "",
                title: "✏️ Lead Details Updated",
                body: `Details updated for lead "${lead.name}".`,
                type: "lead_updated",
                data: {
                    type: "lead_updated",
                    leadId: lead._id.toString(),
                    passkey: lead.passkey,
                },
            });
        }

        return sendResponse(res, 200, true, "Lead updated successfully", lead);
    } catch (error) {
        console.error("Update Lead Error:", error);
        return sendResponse(res, 500, false, "Error updating lead", null, error.message);
    }
};

// ✅ WEB ENQUIRY NOTIFICATION (FREE CALL / SCALE PLAN / PARTNER FORM)
export const notifyWebEnquiry = async (req, res) => {
    try {
        const { source, business, name, phone, planAmount } = req.body || {};
        const label = source || "Website Enquiry";
        const bodyText = planAmount
            ? `${name || "Someone"} (${business || "Business"}) selected ${planAmount} plan • ${phone || ""}`
            : `${name || "Someone"} (${business || "Business"}) submitted ${label} • ${phone || ""}`;

        await notifyPasskeyUsersAndAdmins({
            passkey: "",
            includePasskeyUsers: false,
            includeAdmins: true,
            title: `🌐 New ${label}`,
            body: bodyText.trim(),
            type: "web_enquiry",
            data: {
                type: "web_enquiry",
                source: label,
            },
        });

        return sendResponse(res, 200, true, "Admin notified successfully");
    } catch (error) {
        console.error("Web Enquiry Notification Error:", error);
        return sendResponse(res, 500, false, "Error notifying admin", null, error.message);
    }
};

// ✅ DELETE LEAD
export const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Lead.findByIdAndDelete(id);
        if (!deleted) {
            return sendResponse(res, 404, false, "Lead not found");
        }
        return sendResponse(res, 200, true, "Lead deleted successfully", deleted);
    } catch (error) {
        console.error("Delete Lead Error:", error);
        return sendResponse(res, 500, false, "Error deleting lead", null, error.message);
    }
};
