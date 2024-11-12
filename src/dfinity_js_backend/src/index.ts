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
    if (!payload.username || !payload.role) {
      return Err({ InvalidPayload: "Ensure all required fields are provided." });
    }

    const existingUser = userStorage.values().find((user) => user.username === payload.username);

    if (existingUser) {
      return Err({ ValidationError: "Username already exists, try another." });
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
    return users.length === 0 ? Err({ NotFound: "No users found." }) : Ok(users);
  }),

  // Get a user by username
  getUserByUsername: query([text], Result(User, Error), (username) => {
    const user = userStorage.values().find((user) => user.username === username);
    return user ? Ok(user) : Err({ NotFound: `User with username ${username} not found.` });
  }),

  // Get a user by role
  getUsersByRole: query([UserRole], Result(Vec(User), Error), (role) => {
    const users = userStorage.values().filter((user) => role in user.role);
    return users.length === 0 ? Err({ NotFound: "No users found with the specified role." }) : Ok(users);
  }),

  // Campaign Management
  createCampaign: update([CampaignPayload], Result(Campaign, Error), (payload) => {
    if (!payload.name || !payload.description) {
      return Err({ InvalidPayload: "Ensure 'name' and 'description' are provided." });
    }

    const userOpt = userStorage.get(payload.created_by);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${payload.created_by} not found.` });
    }

    const user = userOpt.Some;
    const hasValidRole = "Admin" in user.role || "CampaignManager" in user.role;

    if (!hasValidRole) {
      return Err({ Unauthorized: "Only Admins and Campaign Managers can create campaigns." });
    }

    const campaignId = uuidv4();
    const timestamp = new Date().toISOString();
    const campaign = { id: campaignId, ...payload, created_at: timestamp, updated_at: timestamp };

    campaignStorage.insert(campaignId, campaign);
    notifyParticipants(campaignId, "New campaign created.");

    return Ok(campaign);
  }),

  updateCampaign: update([text, CampaignPayload], Result(Campaign, Error), (campaignId, payload) => {
    const existingCampaignOpt = campaignStorage.get(campaignId);
    if ("None" in existingCampaignOpt) {
      return Err({ NotFound: `Campaign with ID ${campaignId} not found.` });
    }

    if (!payload.name || !payload.description) {
      return Err({ InvalidPayload: "Ensure 'name' and 'description' are provided." });
    }

    const userOpt = userStorage.get(payload.created_by);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with ID ${payload.created_by} not found.` });
    }

    const user = userOpt.Some;
    const hasValidRole = "Admin" in user.role || "CampaignManager" in user.role;

    if (!hasValidRole) {
      return Err({ Unauthorized: "Only Admins and Campaign Managers can update campaigns." });
    }

    const updatedCampaign = {
      ...existingCampaignOpt.Some,
      name: payload.name,
      description: payload.description,
      updated_at: new Date().toISOString(),
    };

    campaignStorage.insert(campaignId, updatedCampaign);
    notifyParticipants(campaignId, "Campaign updated.");

    return Ok(updatedCampaign);
  }),

  // Get all campaigns
  getCampaigns: query([], Result(Vec(Campaign), Error), () => {
    const campaigns = campaignStorage.values();
    return campaigns.length === 0 ? Err({ NotFound: "No campaigns found." }) : Ok(campaigns);
  }),

  // Get Campaign by Id
  getCampaignById: query([text], Result(Campaign, Error), (campaignId) => {
    const campaignOpt = campaignStorage.get(campaignId);
    return "None" in campaignOpt ? Err({ NotFound: `Campaign with ID ${campaignId} not found.` }) : Ok(campaignOpt.Some);
  }),

  // Notification Helper
  function notifyParticipants(campaignId: text, message: text): void {
    const notificationId = uuidv4();
    notificationStorage.insert(notificationId, {
      id: notificationId,
      campaign_id: campaignId,
      message: message,
      created_at: new Date().toISOString(),
    });
  }
});
