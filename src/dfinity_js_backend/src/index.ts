import {
  query,
  update,
  text,
  Null,
  Record,
  StableBTreeMap,
  Variant,
  Vec,
  None,
  Some,
  Ok,
  Err,
  ic,
  Principal,
  Opt,
  nat64,
  Duration,
  Result,
  bool,
  Canister,
} from "azle";
import { v4 as uuidv4 } from "uuid";

// Enums
const UserRole = Variant({
  Admin: Null,
  CampaignManager: Null,
  Donor: Null,
});

// Record Types
const Campaign = Record({
  id: text,
  name: text,
  description: text,
  created_by: text,
  created_at: text,
  updated_at: text,
});

const Donation = Record({
  id: text,
  campaign_id: text,
  donor_name: text,
  amount: nat64,
  created_at: text,
});

const Expense = Record({
  id: text,
  campaign_id: text,
  description: text,
  amount: nat64,
  created_at: text,
});

const VoterOutreach = Record({
  id: text,
  campaign_id: text,
  activity: text,
  date: text,
  status: text,
  created_at: text,
});

const SecureMessage = Record({
  id: text,
  campaign_id: text,
  sender: text,
  content: text,
  created_at: text,
});

const Notification = Record({
  id: text,
  campaign_id: text,
  message: text,
  created_at: text,
});

const User = Record({
  id: text,
  owner: Principal,
  username: text,
  role: UserRole,
  points: nat64,
  created_at: text,
});

// Payload Types
const CampaignPayload = Record({
  name: text,
  description: text,
  created_by: text,
});

const DonationPayload = Record({
  campaign_id: text,
  donor_name: text,
  amount: nat64,
});

const ExpensePayload = Record({
  campaign_id: text,
  description: text,
  amount: nat64,
});

const VoterOutreachPayload = Record({
  campaign_id: text,
  activity: text,
  date: text,
  status: text,
});

const MessagePayload = Record({
  campaign_id: text,
  sender: text,
  content: text,
});

const UserPayload = Record({
  username: text,
  role: UserRole,
});

// Error Type
const Error = Variant({
  NotFound: text,
  InvalidPayload: text,
  Unauthorized: text,
  ValidationError: text,
});

// Storage
const campaignStorage = StableBTreeMap(0, text, Campaign);
const donationStorage = StableBTreeMap(1, text, Donation);
const expenseStorage = StableBTreeMap(2, text, Expense);
const outreachStorage = StableBTreeMap(3, text, VoterOutreach);
const messageStorage = StableBTreeMap(4, text, SecureMessage);
const notificationStorage = StableBTreeMap(5, text, Notification);
const userStorage = StableBTreeMap(6, text, User);

export default Canister({
  // User Management
  createUser: update([UserPayload], Result(User, Error), (payload) => {
    // Validate the user input to ensure he/she provides all the required fields
    if (!payload.role || !payload.role) {
      return Err({
        InvalidPayload: " Ensure all required fields are provided!",
      });
    }

    // Ensure username is unique
    const existingUser = userStorage
      .values()
      .find((user) => user.username === payload.username);

    if (existingUser) {
      return Err({
        ValidationError:
          "Username already exists 😲 🤯 😮 😱 😳 ✨, try another one",
      });
    }

    const userId = uuidv4();
    const user = {
      id: userId,
      owner: ic.caller(),
      ...payload,
      points: 0n,
      created_at: new Date().toISOString(),
    };

    userStorage.insert(userId, user);
    return Ok(user);
  }),

  // Get all users
  getUsers: query([], Result(Vec(User), Error), () => {
    const users = userStorage.values();
    if (users.length === 0) {
      return Err({ NotFound: "No users found" });
    }
    return Ok(users);
  }),

  // Get a user by username
  getUserByUsername: query([text], Result(User, Error), (username) => {
    const user = userStorage
      .values()
      .find((user) => user.username === username);

    if (!user) {
      return Err({
        NotFound: `User with username ${UserPayload.username} not found`,
      });
    }

    return Ok(user);
  }),

  // Get a user by role
  getUsersByRole: query([UserRole], Result(Vec(User), Error), (role) => {
    const users = userStorage.values().filter((user) => {
      if (role.Admin !== null) {
        return user.role.Admin !== null;
      } else if (role.CampaignManager !== null) {
        return user.role.CampaignManager !== null;
      } else {
        return false;
      }
    });

    if (users.length === 0) {
      return Err({ NotFound: "No users found with the specified role" });
    }

    return Ok(users);
  }),

  // Campaign Management
  createCampaign: update(
    [CampaignPayload],
    Result(Campaign, Error),
    (payload) => {
      // Validate the inputs in the payload
      if (!payload.name || !payload.description) {
        return Err({
          InvalidPayload: "Ensure 'name' and 'description' are provided",
        });
      }

      // Validate the created_by field
      const userOpt = userStorage.get(payload.created_by);

      if (userOpt === null) {
        return Err({
          NotFound: `User with ID ${payload.created_by} not found`,
        });
      }

      // Verify user is either Admin or Campaign Manager
      const hasValidRole =
        "Admin" in userOpt.Some.role || "CampaignManager" in userOpt.Some.role;

      if (!hasValidRole) {
        return Err({
          Unauthorized:
            "Only Admins and Campaign Managers can create campaigns",
        });
      }

      const campaignId = uuidv4();
      const timestamp = new Date().toISOString();

      const campaign = {
        id: campaignId,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: timestamp,
      };

      campaignStorage.insert(campaignId, campaign);
      notifyParticipants(campaignId, "New campaign created.");

      return Ok(campaign);
    }
  ),

  updateCampaign: update(
    [text, CampaignPayload],
    Result(Campaign, Error),
    (campaignId, payload) => {
      // Check if campaign exists using .get()
      const existingCampaignOpt = campaignStorage.get(campaignId);
      if ("None" in existingCampaignOpt) {
        return Err({
          NotFound: `Campaign with ID ${campaignId} not found`,
        });
      }

      const existingCampaign = existingCampaignOpt.Some;

      // Validate the inputs in the payload
      if (!payload.name || !payload.description) {
        return Err({
          InvalidPayload: "Ensure 'name' and 'description' are provided",
        });
      }

      // Validate the created_by field
      const userOpt = userStorage.get(payload.created_by);
      if ("None" in userOpt) {
        return Err({
          NotFound: `User with ID ${payload.created_by} not found`,
        });
      }

      // Verify user is either Admin or Campaign Manager
      const hasValidRole =
        "Admin" in userOpt.Some.role || "CampaignManager" in userOpt.Some.role;

      if (!hasValidRole) {
        return Err({
          Unauthorized:
            "Only Admins and Campaign Managers can update campaigns",
        });
      }

      const updatedCampaign = {
        ...existingCampaign,
        name: payload.name,
        description: payload.description,
        created_by: payload.created_by,
        updated_at: new Date().toISOString(),
      };

      campaignStorage.insert(campaignId, updatedCampaign);
      notifyParticipants(campaignId, "Campaign updated.");

      return Ok(updatedCampaign);
    }
  ),

  // Get all campaigns
  getCampaigns: query([], Result(Vec(Campaign), Error), () => {
    const campaigns = campaignStorage.values();
    if (campaigns.length === 0) {
      return Err({ NotFound: "No campaigns found" });
    }
    return Ok(campaigns);
  }),

  // Get Campaign by Id
  getCampaignById: query([text], Result(Campaign, Error), (campaignId) => {
    // Check if campaign exists using .get()
    const campaignOpt = campaignStorage.get(campaignId);

    // If campaign doesn't exist, return error
    if ("None" in campaignOpt) {
      return Err({
        NotFound: `Campaign with ID ${campaignId} not found`,
      });
    }

    // Return the campaign if found
    return Ok(campaignOpt.Some);
  }),

  // Donation Management
  createDonation: update(
    [DonationPayload, UserPayload],
    Result(Donation, Error),
    (payload, userPayload) => {
      // Authenticate user by checking storage
      const users = userStorage.values();
      const user = users.find((u) => u.username === userPayload.username);

      // Check if user exists
      if (!user) {
        return Err({
          Unauthorized: "User not found",
        });
      }

      // Verify user has Donor role
      if (!("Donor" in user.role)) {
        return Err({
          Unauthorized: "Only donors can create donations",
        });
      }

      // Validate donation payload
      if (!payload.donor_name || payload.amount <= 0n) {
        return Err({
          InvalidPayload: "Ensure donor name and valid amount are provided",
        });
      }

      // Verify campaign exists
      const campaignOpt = campaignStorage.get(payload.campaign_id);
      if ("None" in campaignOpt) {
        return Err({
          NotFound: "Campaign not found",
        });
      }

      const donationId = uuidv4();
      const timestamp = new Date().toISOString();

      const donation = {
        id: donationId,
        ...payload,
        created_at: timestamp,
      };

      donationStorage.insert(donationId, donation);
      notifyParticipants(donation.campaign_id, "New donation received.");

      return Ok(donation);
    }
  ),

  // Get Donation by Id
  getDonationById: query([text], Result(Donation, Error), (donationId) => {
    // Check if donation exists using .get()
    const donationOpt = donationStorage.get(donationId);

    // If donation doesn't exist, return error
    if ("None" in donationOpt) {
      return Err({
        NotFound: `Donation with ID ${donationId} not found`,
      });
    }

    // Check if the campaign associated with this donation still exists
    const campaignOpt = campaignStorage.get(donationOpt.Some.campaign_id);
    if ("None" in campaignOpt) {
      return Err({
        NotFound: `Associated campaign with ID ${donationOpt.Some.campaign_id} not found. The campaign may have been deleted.`,
      });
    }

    // Return the donation if everything is valid
    return Ok(donationOpt.Some);
  }),

  getDonationsByCampaignId: query(
    [text],
    Result(Vec(Donation), Error),
    (campaignId) => {
      const donations = donationStorage
        .values()
        .filter((donation) => donation.campaign_id === campaignId);

      if (donations.length === 0) {
        return Err({ NotFound: "No donations found for this campaign" });
      }

      return Ok(donations);
    }
  ),

  // Expense Management
  createExpense: update(
    [ExpensePayload, UserPayload],
    Result(Expense, Error),
    (payload, userPayload) => {
      // Authenticate user by checking storage
      const users = userStorage.values();
      const user = users.find((u) => u.username === userPayload.username);

      // Check if user exists
      if (!user) {
        return Err({
          Unauthorized: "User not found",
        });
      }

      // Verify user has Admin role
      if (!("Admin" in user.role)) {
        return Err({
          Unauthorized: "Only admins can create expenses",
        });
      }

      if (!payload.description || payload.amount <= 0n) {
        return Err({
          InvalidPayload: "Ensure description and valid amount are provided",
        });
      }

      // Verify campaign exists
      const campaign = campaignStorage.get(payload.campaign_id);
      if (!campaign) {
        return Err({ NotFound: "Campaign not found" });
      }

      const expenseId = uuidv4();
      const timestamp = new Date().toISOString();

      const expense = {
        id: expenseId,
        ...payload,
        created_at: timestamp,
      };

      expenseStorage.insert(expenseId, expense);
      notifyParticipants(expense.campaign_id, "New expense recorded.");

      return Ok(expense);
    }
  ),

  getExpensesByCampaignId: query(
    [text],
    Result(Vec(Expense), Error),
    (campaignId) => {
      const expenses = expenseStorage
        .values()
        .filter((expense) => expense.campaign_id === campaignId);

      if (expenses.length === 0) {
        return Err({ NotFound: "No expenses found for this campaign" });
      }

      return Ok(expenses);
    }
  ),

  // Voter Outreach Management
  createVoterOutreach: update(
    [VoterOutreachPayload, UserPayload],
    Result(VoterOutreach, Error),
    (payload, userPayload) => {
      // Authenticate user by checking storage
      const users = userStorage.values();
      const user = users.find((u) => u.username === userPayload.username);

      if (!user) {
        return Err({ Unauthorized: "Invalid credentials" });
      }

      if (!payload.activity || !payload.date || !payload.status) {
        return Err({
          InvalidPayload: "Ensure activity, date and status are provided",
        });
      }

      // Verify campaign exists
      const campaign = campaignStorage.get(payload.campaign_id);
      if (!campaign) {
        return Err({ NotFound: "Campaign not found" });
      }

      const outreachId = uuidv4();
      const outreach = {
        id: outreachId,
        campaign_id: payload.campaign_id,
        activity: payload.activity,
        date: payload.date,
        status: payload.status,
        created_at: new Date().toISOString(),
      };

      outreachStorage.insert(outreachId, outreach);
      notifyParticipants(outreach.campaign_id, "New voter outreach recorded.");

      return Ok(outreach);
    }
  ),

  getVoterOutreachByCampaignId: query(
    [text],
    Result(Vec(VoterOutreach), Error),
    (campaignId) => {
      const outreaches = outreachStorage
        .values()
        .filter((outreach) => outreach.campaign_id === campaignId);

      if (outreaches.length === 0) {
        return Err({ NotFound: "No voter outreach found for this campaign" });
      }

      return Ok(outreaches);
    }
  ),

  // Secure Message Management
  createMessage: update(
    [MessagePayload, UserPayload],
    Result(SecureMessage, Error),
    (payload, userPayload) => {
      // Authenticate user by checking storage
      const users = userStorage.values();
      const user = users.find((u) => u.username === userPayload.username);

      if (!user) {
        return Err({ Unauthorized: "Invalid credentials" });
      }

      if (!payload.sender || !payload.content) {
        return Err({
          InvalidPayload: "Ensure sender and content are provided",
        });
      }

      // Verify if Sender Exists
      const sender = userStorage.get(payload.sender);

      if ("None" in sender) {
        return Err({
          NotFound: `Sender with ID ${payload.sender} not found`,
        });
      }

      // Verify campaign exists
      const campaign = campaignStorage.get(payload.campaign_id);
      if ("None" in campaign) {
        return Err({ NotFound: "Campaign not found" });
      }

      const messageId = uuidv4();
      const message = {
        id: messageId,
        ...payload,
        created_at: new Date().toISOString(),
      };

      messageStorage.insert(messageId, message);
      notifyParticipants(message.campaign_id, "New message sent.");

      return Ok(message);
    }
  ),

  getMessagesBycampaignId: query(
    [text],
    Result(Vec(SecureMessage), Error),
    (campaignId) => {
      const messages = messageStorage
        .values()
        .filter((message) => message.campaign_id === campaignId);

      if (messages.length === 0) {
        return Err({ NotFound: "No messages found for this campaign" });
      }

      return Ok(messages);
    }
  ),

  // Get Notifications by Campaign ID
  getNotificationsByCampaignId: query(
    [text],
    Result(Vec(Notification), Error),
    (campaignId) => {
      const notifications = notificationStorage
        .values()
        .filter((notification) => notification.campaign_id === campaignId);

      if (notifications.length === 0) {
        return Err({ NotFound: "No notifications found for this campaign" });
      }

      return Ok(notifications);
    }
  ),
});

// Helper function for notifications
function notifyParticipants(campaignId: text, message: text): void {
  const notificationId = uuidv4();
  const notification = {
    id: notificationId,
    campaign_id: campaignId,
    message: message,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  notificationStorage.insert(notificationId, notification);
}
