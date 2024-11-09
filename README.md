
# Election Campaign Manager

The Election Campaign Manager is a decentralized application (DApp) built on the Internet Computer Protocol (ICP) using the Azle framework. This canister provides a robust and secure platform for managing campaigns, donations, expenses, voter outreach activities, secure messaging, and notifications, while ensuring user roles and permissions are strictly enforced.

Designed with scalability and modularity in mind, this canister enables the creation and management of campaigns, facilitates donation collection, tracks expenses, manages voter outreach programs, and allows secure communication between users. The system also integrates a notification mechanism to inform users of important updates.

## Features

- **User Management**: Create and retrieve users by their username or role (Admin, Campaign Manager, Donor).
- **Campaign Management**: Create, update, and retrieve campaigns.
- **Donation Management**: Create donations, and retrieve donations by ID or campaign.
- **Expense Management**: Record and retrieve expenses related to campaigns.
- **Voter Outreach Management**: Manage outreach activities for campaigns.
- **Secure Message Management**: Send and retrieve secure messages related to campaigns.
- **Notification Management**: Send and retrieve notifications related to campaigns.

## Data Models

### User

- `id`: Unique identifier for the user.
- `owner`: Principal of the user.
- `username`: Username of the user.
- `role`: Role of the user (Admin, Campaign Manager, Donor).
- `points`: Points associated with the user.
- `created_at`: Timestamp of when the user was created.

### Campaign

- `id`: Unique identifier for the campaign.
- `name`: Name of the campaign.
- `description`: Description of the campaign.
- `created_by`: User ID of the campaign creator.
- `created_at`: Timestamp of when the campaign was created.
- `updated_at`: Timestamp of when the campaign was last updated.

### Donation

- `id`: Unique identifier for the donation.
- `campaign_id`: ID of the campaign this donation is associated with.
- `donor_name`: Name of the donor.
- `amount`: Amount of the donation.
- `created_at`: Timestamp of when the donation was made.

### Expense

- `id`: Unique identifier for the expense.
- `campaign_id`: ID of the campaign this expense is associated with.
- `description`: Description of the expense.
- `amount`: Amount of the expense.
- `created_at`: Timestamp of when the expense was recorded.

### Voter Outreach

- `id`: Unique identifier for the voter outreach activity.
- `campaign_id`: ID of the campaign this outreach is associated with.
- `activity`: Description of the outreach activity.
- `date`: Date of the outreach activity.
- `status`: Status of the outreach activity.
- `created_at`: Timestamp of when the outreach was recorded.

### Secure Message

- `id`: Unique identifier for the message.
- `campaign_id`: ID of the campaign this message is associated with.
- `sender`: Username of the sender.
- `content`: Content of the message.
- `created_at`: Timestamp of when the message was sent.

### Notification

- `id`: Unique identifier for the notification.
- `campaign_id`: ID of the campaign this notification is associated with.
- `message`: Content of the notification.
- `created_at`: Timestamp of when the notification was created.

## Functions

### User Management

- `createUser`: Create a new user with a specified role and username.
- `getUsers`: Get all users.
- `getUserByUsername`: Get a user by their username.
- `getUsersByRole`: Get users by their role (Admin, Campaign Manager, Donor).

### Campaign Management

- `createCampaign`: Create a new campaign.
- `updateCampaign`: Update an existing campaign.
- `getCampaigns`: Get all campaigns.
- `getCampaignById`: Get a campaign by its ID.

### Donation Management

- `createDonation`: Create a new donation.
- `getDonationById`: Get a donation by its ID.
- `getDonationsByCampaignId`: Get all donations associated with a specific campaign.

### Expense Management

- `createExpense`: Record a new expense.
- `getExpensesByCampaignId`: Get all expenses associated with a specific campaign.

### Voter Outreach Management

- `createVoterOutreach`: Record a new voter outreach activity.
- `getVoterOutreachByCampaignId`: Get all voter outreach activities for a specific campaign.

### Secure Message Management

- `createMessage`: Send a secure message.
- `getMessagesByCampaignId`: Get all messages for a specific campaign.

### Notification Management

- `getNotificationsByCampaignId`: Get all notifications for a specific campaign.

## Error Handling

- **NotFound**: Data not found for the specified query.
- **InvalidPayload**: Provided data is invalid or incomplete.
- **Unauthorized**: User does not have the necessary permissions to perform an action.
- **ValidationError**: The input data failed validation checks.



## Things to be explained in the course:
1. What is Ledger? More details here: https://internetcomputer.org/docs/current/developer-docs/integrations/ledger/
2. What is Internet Identity? More details here: https://internetcomputer.org/internet-identity
3. What is Principal, Identity, Address? https://internetcomputer.org/internet-identity | https://yumimarketplace.medium.com/whats-the-difference-between-principal-id-and-account-id-3c908afdc1f9
4. Canister-to-canister communication and how multi-canister development is done? https://medium.com/icp-league/explore-backend-multi-canister-development-on-ic-680064b06320

## How to deploy canisters implemented in the course

### Ledger canister
`./deploy-local-ledger.sh` - deploys a local Ledger canister. IC works differently when run locally so there is no default network token available and you have to deploy it yourself. Remember that it's not a token like ERC-20 in Ethereum, it's a native token for ICP, just deployed separately.
This canister is described in the `dfx.json`:
```
	"ledger_canister": {
  	"type": "custom",
  	"candid": "https://raw.githubusercontent.com/dfinity/ic/928caf66c35627efe407006230beee60ad38f090/rs/rosetta-api/icp_ledger/ledger.did",
  	"wasm": "https://download.dfinity.systems/ic/928caf66c35627efe407006230beee60ad38f090/canisters/ledger-canister.wasm.gz",
  	"remote": {
    	"id": {
      	"ic": "ryjl3-tyaaa-aaaaa-aaaba-cai"
    	}
  	}
	}
```
`remote.id.ic` - that is the principal of the Ledger canister and it will be available by this principal when you work with the ledger.

Also, in the scope of this script, a minter identity is created which can be used for minting tokens
for the testing purposes.
Additionally, the default identity is pre-populated with 1000_000_000_000 e8s which is equal to 10_000 * 10**8 ICP.
The decimals value for ICP is 10**8.

List identities:
`dfx identity list`

Switch to the minter identity:
`dfx identity use minter`

Transfer ICP:
`dfx ledger transfer <ADDRESS>  --memo 0 --icp 100 --fee 0`
where:
 - `--memo` is some correlation id that can be set to identify some particular transactions (we use that in the marketplace canister).
 - `--icp` is the transfer amount
 - `--fee` is the transaction fee. In this case it's 0 because we make this transfer as the minter idenity thus this transaction is of type MINT, not TRANSFER.
 - `<ADDRESS>` is the address of the recipient. To get the address from the principal, you can use the helper function from the marketplace canister - `getAddressFromPrincipal(principal: Principal)`, it can be called via the Candid UI.


### Internet identity canister

`dfx deploy internet_identity` - that is the canister that handles the authentication flow. Once it's deployed, the `js-agent` library will be talking to it to register identities. There is UI that acts as a wallet where you can select existing identities
or create a new one.

### Marketplace canister

`dfx deploy dfinity_js_backend` - deploys the marketplace canister where the business logic is implemented.
Basically, it implements functions like add, view, update, delete, and buy products + a set of helper functions.

Do not forget to run `dfx generate dfinity_js_backend` anytime you add/remove functions in the canister or when you change the signatures.
Otherwise, these changes won't be reflected in IDL's and won't work when called using the JS agent.

