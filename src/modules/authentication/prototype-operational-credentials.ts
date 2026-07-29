export interface PrototypeOperationalCredential {
  readonly accountId: string;
  readonly displayName: string;
  readonly password: string;
  readonly role: "administrator" | "vendor";
  readonly stallLocation?: string;
  readonly storeType?: "food" | "games";
  readonly username: string;
}

export const prototypeVendorCredentials = Object.freeze([
  {
    accountId: "account-vendor-001",
    displayName: "Stick & Grip Pro Shop",
    password: "TokenlyGame01!",
    role: "vendor",
    stallLocation: "Games Row, Booth 01",
    storeType: "games",
    username: "GameVendor01",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Floorball Gear Lab",
    password: "TokenlyGame02!",
    role: "vendor",
    stallLocation: "Games Row, Booth 02",
    storeType: "games",
    username: "GameVendor02",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Blade & Ball Supply",
    password: "TokenlyGame03!",
    role: "vendor",
    stallLocation: "Games Row, Booth 03",
    storeType: "games",
    username: "GameVendor03",
  },
  {
    accountId: "account-vendor-001",
    displayName: "CourtCraft Games",
    password: "TokenlyGame04!",
    role: "vendor",
    stallLocation: "Games Row, Booth 04",
    storeType: "games",
    username: "GameVendor04",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Net Rush Equipment",
    password: "TokenlyGame05!",
    role: "vendor",
    stallLocation: "Games Row, Booth 05",
    storeType: "games",
    username: "GameVendor05",
  },
  {
    accountId: "account-vendor-001",
    displayName: "PowerPlay Pro Shop",
    password: "TokenlyGame06!",
    role: "vendor",
    stallLocation: "Games Row, Booth 06",
    storeType: "games",
    username: "GameVendor06",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Courtside Kitchen",
    password: "TokenlyFood01!",
    role: "vendor",
    stallLocation: "Food Street, Booth 01",
    storeType: "food",
    username: "FoodVendor01",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Rally Bites",
    password: "TokenlyFood02!",
    role: "vendor",
    stallLocation: "Food Street, Booth 02",
    storeType: "food",
    username: "FoodVendor02",
  },
  {
    accountId: "account-vendor-001",
    displayName: "The Noodle Bench",
    password: "TokenlyFood03!",
    role: "vendor",
    stallLocation: "Food Street, Booth 03",
    storeType: "food",
    username: "FoodVendor03",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Goal Line Drinks",
    password: "TokenlyFood04!",
    role: "vendor",
    stallLocation: "Food Street, Booth 04",
    storeType: "food",
    username: "FoodVendor04",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Half-Time Snacks",
    password: "TokenlyFood05!",
    role: "vendor",
    stallLocation: "Food Street, Booth 05",
    storeType: "food",
    username: "FoodVendor05",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Sweet Spot Desserts",
    password: "TokenlyFood06!",
    role: "vendor",
    stallLocation: "Food Street, Booth 06",
    storeType: "food",
    username: "FoodVendor06",
  },
] as const satisfies readonly PrototypeOperationalCredential[]);

export const prototypeOperationalCredentials = Object.freeze([
  {
    accountId: "account-admin-001",
    displayName: "Event administrator",
    password: "Lance888!",
    role: "administrator",
    username: "AdminLance",
  },
  {
    accountId: "account-vendor-001",
    displayName: "Vendor 1",
    password: "Vendor1",
    role: "vendor",
    username: "Vendor1",
  },
  ...prototypeVendorCredentials,
] as const satisfies readonly PrototypeOperationalCredential[]);
