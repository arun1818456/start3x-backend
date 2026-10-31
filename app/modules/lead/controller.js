import Lead from "./model.js";
import { sendResponse } from "../../utils/sendResposeType.js";

// ✅ CREATE LEAD / ASSIGN LEAD TO PASSKEY
export const createLead = async (req, res) => {
    try {
        console.log("📥 Create Lead Request:", req.body);
        const {
            passkey,
            name,
            rank,
            location,
            company,
            status,
            date,
            phoneNumber,
            altPhoneNumber,
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
            rank: rank || `#${totalLeads + 1}`,
            location: location || 'chandigarh',
            company: company || 'Sunrays',
            status: status || 'To-Do:',
            date: date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            phoneNumber: phoneNumber || '',
            altPhoneNumber: altPhoneNumber || '',
            kw: kw || '',
            electricityBill: electricityBill || '',
            textNote: textNote || '',
            responses: [],
            createdBy: req.user?._id || null,
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
            .populate('responses')
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
        const { responses, status, name, location, company, phoneNumber, altPhoneNumber, kw, electricityBill, textNote } = req.body || {};

        const lead = await Lead.findById(id);
        if (!lead) {
            return sendResponse(res, 404, false, "Lead not found");
        }

        if (status) lead.status = status;
        if (name) lead.name = name;
        if (location) lead.location = location;
        if (company) lead.company = company;
        if (phoneNumber) lead.phoneNumber = phoneNumber;
        if (altPhoneNumber) lead.altPhoneNumber = altPhoneNumber;
        if (kw) lead.kw = kw;
        if (electricityBill) lead.electricityBill = electricityBill;
        if (textNote) lead.textNote = textNote;
        if (responses && Array.isArray(responses)) {
            lead.responses = responses.map((r) => (typeof r === 'object' && r._id) ? r._id : r);
        }

        await lead.save();
        await lead.populate('responses');

        return sendResponse(res, 200, true, "Lead updated successfully", lead);
    } catch (error) {
        console.error("Update Lead Error:", error);
        return sendResponse(res, 500, false, "Error updating lead", null, error.message);
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
