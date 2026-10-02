export type CivicSchemeLevel = "state" | "central";
export type CivicSchemeCategory = "farmer" | "student" | "women" | "health" | "pension" | "housing" | "employment" | "business" | "disability" | "food";
export type CivicApplicationMode = "online" | "office" | "camp";

export interface CivicRequirement {
  label: string;
  required: boolean;
  note?: string;
}

export interface CivicScheme {
  id: string;
  name: string;
  shortName?: string;
  level: CivicSchemeLevel;
  state: string;
  department: string;
  categories: CivicSchemeCategory[];
  benefit: string;
  eligibility: string[];
  documents: CivicRequirement[];
  applicationModes: CivicApplicationMode[];
  applicationSteps: string[];
  submissionPoints: string[];
  officialInfoUrl: string;
  officialApplyUrl?: string;
  helpline?: string;
  lastVerifiedAt: string;
  sourceNote: string;
}

export const CIVIC_CATEGORIES: Array<{ id: CivicSchemeCategory; label: string }> = [
  { id: "farmer", label: "Farmers" },
  { id: "student", label: "Students" },
  { id: "women", label: "Women & girls" },
  { id: "health", label: "Health" },
  { id: "pension", label: "Pension" },
  { id: "housing", label: "Housing" },
  { id: "employment", label: "Jobs & skills" },
  { id: "business", label: "Business" },
  { id: "disability", label: "Disability support" },
  { id: "food", label: "Food & ration" },
];

/**
 * Starter catalogue for the West Bengal MVP. Every record links to an official
 * government source; eligibility still needs confirmation from the department.
 */
export const WEST_BENGAL_SCHEMES: CivicScheme[] = [
  {
    id: "kanyashree-prakalpa",
    name: "Kanyashree Prakalpa",
    level: "state",
    state: "West Bengal",
    department: "Department of Women & Child Development and Social Welfare",
    categories: ["women", "student"],
    benefit: "Financial support designed to help girls stay in education and delay marriage.",
    eligibility: ["Girl student resident in West Bengal", "Age and school/education conditions apply", "Family income and other conditions may apply to the relevant component"],
    documents: [{ label: "Proof of age", required: true }, { label: "School or education institution record", required: true }, { label: "Bank account details", required: true }, { label: "Residence proof", required: false, note: "Only if requested by the institution or department" }],
    applicationModes: ["office"],
    applicationSteps: ["Ask the school, college, or registered education institution for the Kanyashree application route.", "Submit the required student and bank details through the institution.", "Keep the acknowledgement or beneficiary reference for follow-up."],
    submissionPoints: ["School or college nodal contact", "Block or district social welfare office when directed"],
    officialInfoUrl: "https://wb.gov.in/ Schemes.aspx".replace(" ", ""),
    helpline: "Check the current official portal or institution notice for the latest contact details.",
    lastVerifiedAt: "2026-10-02",
    sourceNote: "West Bengal Government scheme directory; confirm the active component and current dates before applying.",
  },
  {
    id: "lakshmir-bhandar",
    name: "Lakshmir Bhandar",
    level: "state",
    state: "West Bengal",
    department: "Department of Women & Child Development and Social Welfare",
    categories: ["women"],
    benefit: "Monthly financial assistance for eligible women residents of West Bengal, subject to the current rules.",
    eligibility: ["Woman resident of West Bengal", "Age, household and category conditions apply", "Government employee or pensioner exclusions may apply"],
    documents: [{ label: "Aadhaar or accepted identity proof", required: true }, { label: "Bank account linked to the applicant", required: true }, { label: "Residence and category documents", required: true, note: "As applicable to the current application form" }, { label: "Mobile number", required: true }],
    applicationModes: ["online", "camp", "office"],
    applicationSteps: ["Check the current notice for the active application window.", "Use the official state portal or attend the notified Duare Sarkar / government camp.", "Submit the form and preserve the acknowledgement number."],
    submissionPoints: ["Official state portal when applications are open", "Duare Sarkar camp or designated government counter"],
    officialInfoUrl: "https://wb.gov.in/ Schemes.aspx".replace(" ", ""),
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Use only the current West Bengal Government notice; camp dates and eligibility can change.",
  },
  {
    id: "krishak-bandhu",
    name: "Krishak Bandhu",
    level: "state",
    state: "West Bengal",
    department: "Department of Agriculture, Government of West Bengal",
    categories: ["farmer"],
    benefit: "Agricultural support and eligible farmer assistance under the current Krishak Bandhu rules.",
    eligibility: ["Farmer or recorded cultivator meeting the current land and registration conditions", "West Bengal residence and verified agricultural records", "Benefit amount and conditions depend on the active notification"],
    documents: [{ label: "Land or cultivation record", required: true }, { label: "Aadhaar or accepted identity proof", required: true }, { label: "Bank account details", required: true }, { label: "Mobile number", required: false }],
    applicationModes: ["online", "office"],
    applicationSteps: ["Check the official Agriculture Department or Krishak Bandhu portal.", "Verify farmer and land records with the local agriculture office if details are missing.", "Submit or update the registration and save the acknowledgement."],
    submissionPoints: ["Block Agriculture Office", "Agriculture Department portal or notified local facilitation counter"],
    officialInfoUrl: "https://krishakbandhu.wb.gov.in/",
    officialApplyUrl: "https://krishakbandhu.wb.gov.in/",
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Portal and farmer-record requirements should be rechecked before submission.",
  },
  {
    id: "swasthya-sathi",
    name: "Swasthya Sathi",
    level: "state",
    state: "West Bengal",
    department: "Department of Health & Family Welfare, Government of West Bengal",
    categories: ["health"],
    benefit: "Cashless health coverage and hospital support for eligible families under the active scheme rules.",
    eligibility: ["Resident household covered by the current state scheme criteria", "Family member details must be correctly recorded", "Treatment and hospital coverage depend on the current package and empanelment"],
    documents: [{ label: "Identity and family details", required: true }, { label: "Mobile number", required: true }, { label: "Existing Swasthya Sathi card or enrolment reference", required: false }],
    applicationModes: ["online", "camp", "office"],
    applicationSteps: ["Check eligibility and enrolment information on the official portal.", "Visit a notified camp or help desk if family details need correction.", "Use the official hospital list and carry the card or reference when seeking treatment."],
    submissionPoints: ["Official Swasthya Sathi portal", "Notified Duare Sarkar camp or help desk", "Empanelled hospital help desk for service guidance"],
    officialInfoUrl: "https://swasthyasathi.gov.in/",
    officialApplyUrl: "https://swasthyasathi.gov.in/",
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Coverage, hospital list, and enrolment rules are subject to official updates.",
  },
  {
    id: "rupashree-prakalpa",
    name: "Rupashree Prakalpa",
    level: "state",
    state: "West Bengal",
    department: "Department of Women & Child Development and Social Welfare",
    categories: ["women"],
    benefit: "One-time assistance for eligible adult women at the time of marriage under the current rules.",
    eligibility: ["Applicant and family must meet the current age, residence and income conditions", "Marriage-related documentation is required", "Application timing must follow the official department process"],
    documents: [{ label: "Proof of age and residence", required: true }, { label: "Income certificate", required: true }, { label: "Bank account details", required: true }, { label: "Marriage-related documents", required: true }],
    applicationModes: ["office"],
    applicationSteps: ["Collect the current form from the local government office or official channel.", "Attach the income, identity, residence and marriage-related documents.", "Submit before the applicable deadline and keep the receipt."],
    submissionPoints: ["Block Development Office", "Municipality or designated local authority"],
    officialInfoUrl: "https://wb.gov.in/ Schemes.aspx".replace(" ", ""),
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Confirm the current income ceiling, age condition, and submission window with the local authority.",
  },
  {
    id: "yuvasree-prakalpa",
    name: "Yuvasree Prakalpa",
    level: "state",
    state: "West Bengal",
    department: "Department of Labour, Government of West Bengal",
    categories: ["employment"],
    benefit: "Employment assistance and related support for eligible registered job seekers under current rules.",
    eligibility: ["Registered job seeker meeting the scheme's current age and education conditions", "West Bengal residence", "Applicant must follow the employment exchange and verification process"],
    documents: [{ label: "Employment exchange or job-seeker registration", required: true }, { label: "Identity and residence proof", required: true }, { label: "Education certificate", required: true }, { label: "Bank account details", required: true }],
    applicationModes: ["online", "office"],
    applicationSteps: ["Create or verify the job-seeker registration through the official employment portal.", "Check whether a fresh Yuvasree application window is open.", "Complete verification and save the application reference."],
    submissionPoints: ["West Bengal employment exchange / designated labour office", "Official state employment portal when enabled"],
    officialInfoUrl: "https://www.wb.gov.in/",
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Application windows and programme availability must be confirmed from the current Labour Department notice.",
  },
  {
    id: "joy-johar",
    name: "Jai Johar",
    level: "state",
    state: "West Bengal",
    department: "Department of Backward Classes Welfare and Tribal Development",
    categories: ["pension"],
    benefit: "Social security pension support for eligible Scheduled Tribe senior citizens under current rules.",
    eligibility: ["Scheduled Tribe resident of West Bengal", "Senior citizen age condition applies", "Income and other pension conditions may apply"],
    documents: [{ label: "Age proof", required: true }, { label: "Tribe certificate", required: true }, { label: "Residence proof", required: true }, { label: "Bank account details", required: true }],
    applicationModes: ["office", "camp"],
    applicationSteps: ["Confirm the current form and eligibility with the local social welfare office.", "Submit identity, tribe, age and bank documents.", "Keep the acknowledgement and ask how to check pension status."],
    submissionPoints: ["Block Development Office", "Municipality or notified Duare Sarkar camp"],
    officialInfoUrl: "https://wb.gov.in/ Schemes.aspx".replace(" ", ""),
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Confirm current pension amount and category conditions with the responsible department.",
  },
  {
    id: "joy-johar-backward",
    name: "Tapasili Bandhu",
    level: "state",
    state: "West Bengal",
    department: "Department of Backward Classes Welfare and Tribal Development",
    categories: ["pension"],
    benefit: "Social security pension support for eligible Scheduled Caste senior citizens under current rules.",
    eligibility: ["Scheduled Caste resident of West Bengal", "Senior citizen age condition applies", "Income and other pension conditions may apply"],
    documents: [{ label: "Age proof", required: true }, { label: "Caste certificate", required: true }, { label: "Residence proof", required: true }, { label: "Bank account details", required: true }],
    applicationModes: ["office", "camp"],
    applicationSteps: ["Confirm the current form and eligibility with the local social welfare office.", "Submit identity, caste, age and bank documents.", "Keep the acknowledgement and ask how to check pension status."],
    submissionPoints: ["Block Development Office", "Municipality or notified Duare Sarkar camp"],
    officialInfoUrl: "https://wb.gov.in/ Schemes.aspx".replace(" ", ""),
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Confirm current pension amount and category conditions with the responsible department.",
  },
  {
    id: "anandadhara",
    name: "Anandadhara",
    level: "state",
    state: "West Bengal",
    department: "West Bengal State Rural Livelihoods Mission",
    categories: ["business", "employment", "women"],
    benefit: "Self-help group and rural livelihood support, including training and access to livelihood activities.",
    eligibility: ["Rural household or self-help group member in the programme area", "Group and local mission conditions apply", "Support depends on the local plan and approved activity"],
    documents: [{ label: "Self-help group or local mission record", required: true }, { label: "Identity and residence proof", required: true }, { label: "Bank account details", required: true }],
    applicationModes: ["office"],
    applicationSteps: ["Contact the local self-help group, Gram Panchayat, or block livelihood mission office.", "Ask about group formation, training, and current livelihood activities.", "Submit the documents requested by the local mission team."],
    submissionPoints: ["Gram Panchayat", "Block Development Office / local livelihood mission office"],
    officialInfoUrl: "https://anandadhara.wb.gov.in/",
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Local programme availability and activity selection must be confirmed at block level.",
  },
  {
    id: "karmasathi-prakalpa",
    name: "Karmasathi Prakalpa",
    level: "state",
    state: "West Bengal",
    department: "Department of Micro, Small & Medium Enterprises and Textiles",
    categories: ["business", "employment"],
    benefit: "Credit-linked support for eligible young entrepreneurs starting or expanding a small business, subject to current rules.",
    eligibility: ["West Bengal resident meeting the current age and project conditions", "Viable self-employment or small business proposal", "Bank appraisal, documentation and scheme limits apply"],
    documents: [{ label: "Identity and residence proof", required: true }, { label: "Business or project proposal", required: true }, { label: "Bank and financial documents", required: true }, { label: "Training or qualification proof", required: false }],
    applicationModes: ["online", "office"],
    applicationSteps: ["Read the current MSME scheme notice and prepare a simple project plan.", "Apply through the official portal or designated office/bank route.", "Keep the application and bank acknowledgement for follow-up."],
    submissionPoints: ["Official MSME portal or district facilitation centre", "Participating bank branch when directed"],
    officialInfoUrl: "https://wb.gov.in/ Schemes.aspx".replace(" ", ""),
    lastVerifiedAt: "2026-10-02",
    sourceNote: "Loan, subsidy, age and project limits may change; confirm with MSME and the participating bank.",
  },
];

export const CATEGORY_LABELS = Object.fromEntries(CIVIC_CATEGORIES.map((category) => [category.id, category.label])) as Record<CivicSchemeCategory, string>;
