export interface HashtagPack { high: string[]; mid: string[]; low: string[]; }

export const HASHTAG_NICHES = [
  "fitness", "finance", "travel", "food", "fashion", "tech", "photography", "motivation",
] as const;

export type HashtagNiche = (typeof HASHTAG_NICHES)[number];

export const HASHTAG_PACKS: Record<HashtagNiche, HashtagPack> = {
  fitness: {
    high: ["fitness", "gym", "workout", "fitnessmotivation", "gymlife", "bodybuilding"],
    mid: ["fitfam", "gymrat", "legday", "personaltrainer", "fitlife", "homeworkout"],
    low: ["morninglift", "gymgrinddaily", "fitjourney2026", "liftwithme", "trainhardstayhumble", "sweatitout"],
  },
  finance: {
    high: ["finance", "money", "investing", "stockmarket", "entrepreneur", "wealth"],
    mid: ["personalfinance", "financialfreedom", "investingtips", "moneymindset", "passiveincome", "budgeting"],
    low: ["moneytalksdaily", "wealthbuilding101", "financetips2026", "investsmartlivewell", "debtfreejourney", "compoundgrowth"],
  },
  travel: {
    high: ["travel", "wanderlust", "travelgram", "instatravel", "travelphotography", "vacation"],
    mid: ["travelblogger", "passportready", "roamtheplanet", "traveladdict", "exploremore", "bucketlist"],
    low: ["hiddenplacesearth", "traveldiary2026", "offbeattraveler", "slowtravelclub", "wanderwithme", "trailtotravel"],
  },
  food: {
    high: ["food", "foodie", "instafood", "foodphotography", "yummy", "delicious"],
    mid: ["foodblogger", "homecooking", "easyrecipes", "foodlover", "brunch", "streetfood"],
    low: ["tastytable2026", "cookwithlove", "fooddiarydaily", "recipehunter", "flavorfirst", "kitchendiariesx"],
  },
  fashion: {
    high: ["fashion", "style", "ootd", "fashionblogger", "streetstyle", "outfit"],
    mid: ["fashionista", "styleinspo", "lookbook", "minimalstyle", "thriftedfashion", "outfitinspo"],
    low: ["dailyfitcheck", "stylefile2026", "capsulewardrobeclub", "vintagestylelove", "modeststylehub", "fitcheckfriday"],
  },
  tech: {
    high: ["tech", "technology", "innovation", "gadgets", "ai", "startup"],
    mid: ["techtips", "futuretech", "codinglife", "technews", "aitools", "developers"],
    low: ["techdaily2026", "buildinpublic", "indiehackerlife", "promptengineering", "saasfounders", "techstackshare"],
  },
  photography: {
    high: ["photography", "photooftheday", "nature", "photographer", "picoftheday", "capture"],
    mid: ["portraitphotography", "streetphotography", "landscapephotography", "moodygrams", "goldenhour", "shotoniphone"],
    low: ["lightchaser2026", "framehunter", "quietframes", "lensculturefam", "rawmoments", "visualdiaryx"],
  },
  motivation: {
    high: ["motivation", "inspiration", "mindset", "success", "goals", "selflove"],
    mid: ["morningmotivation", "growthmindset", "dreambig", "nevergiveup", "positivity", "selfgrowth"],
    low: ["dailygrind2026", "mindsetmattersmost", "risegrindshine", "purposedrivenlife", "levelupdaily", "innerdriveclub"],
  },
};
