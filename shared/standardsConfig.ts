// International Education Standards Configuration
// Used by both frontend (selector UI) and backend (AI mapping + transcript generation)

export const EDUCATION_STANDARDS = [
  "us",
  "canada",
  "uk",
  "australia-nz",
  "ib",
  "eu",
  "classical",
  "custom",
] as const;

export type EducationStandard = typeof EDUCATION_STANDARDS[number];

export interface StandardConfig {
  id: EducationStandard;
  name: string;
  shortName: string;
  description: string;
  flag: string; // Emoji flag or icon
  icon: string; // Lucide icon name
  tooltip: string;
  
  // Progress terminology
  creditUnit: string; // "credits", "hours", "units", etc.
  creditLabel: string; // "Carnegie Units", "Instructional Hours", etc.
  gradeTerminology: string; // "GPA", "ATAR", "UCAS Points", etc.
  
  // Subject framework
  subjects: string[]; // Required subject areas
  
  // Transcript format
  transcriptFormat: "us" | "uk" | "ib" | "anz" | "eu" | "narrative";
}

export const STANDARDS_CONFIG: Record<EducationStandard, StandardConfig> = {
  us: {
    id: "us",
    name: "United States",
    shortName: "US Credits",
    description: "Carnegie units and traditional credits (0.5 semester, 1.0 full year)",
    flag: "🇺🇸",
    icon: "GraduationCap",
    tooltip: "US high school credits following Carnegie unit standards. Typical graduation requires 24-28 credits across core subjects.",
    creditUnit: "credits",
    creditLabel: "Carnegie Units",
    gradeTerminology: "GPA (0.0-4.0)",
    subjects: ["English", "Math", "Science", "Social Studies", "Foreign Language", "Electives"],
    transcriptFormat: "us",
  },
  
  canada: {
    id: "canada",
    name: "Canada",
    shortName: "Canadian Hours",
    description: "Provincial instructional hours and credits (varies by province)",
    flag: "🇨🇦",
    icon: "MapPin",
    tooltip: "Canadian provincial standards. Requirements vary by province (e.g., Ontario requires 30 credits, BC uses course-based system). Tracks instructional hours.",
    creditUnit: "hours",
    creditLabel: "Instructional Hours",
    gradeTerminology: "Percentage (0-100%)",
    subjects: ["English", "Mathematics", "Science", "Social Studies", "French", "Electives"],
    transcriptFormat: "us", // Similar format to US
  },
  
  uk: {
    id: "uk",
    name: "United Kingdom",
    shortName: "GCSE / A-Level",
    description: "GCSE and A-Level qualifications with National Curriculum key stages",
    flag: "🇬🇧",
    icon: "BookOpen",
    tooltip: "UK qualifications framework: GCSEs (Key Stage 4, ages 14-16) and A-Levels (Key Stage 5, ages 16-18). Assessed via exam boards (AQA, Edexcel, OCR).",
    creditUnit: "qualifications",
    creditLabel: "GCSE / A-Level Subjects",
    gradeTerminology: "UCAS Points / Grades (9-1 for GCSE, A*-E for A-Level)",
    subjects: ["English Language & Literature", "Mathematics", "Sciences", "Humanities", "Modern Languages", "Arts"],
    transcriptFormat: "uk",
  },
  
  "australia-nz": {
    id: "australia-nz",
    name: "Australia / New Zealand",
    shortName: "NCEA / ATAR",
    description: "NCEA levels (NZ) and Australian Curriculum with ATAR pathways",
    flag: "🇦🇺", // Could also use 🇳🇿
    icon: "Globe",
    tooltip: "Australian Curriculum (Years 11-12) with ATAR for university entry, or NZ's NCEA Levels 1-3. Achievement standards with internal/external assessment.",
    creditUnit: "credits",
    creditLabel: "NCEA Credits / Units",
    gradeTerminology: "ATAR (0-99.95) / NCEA Levels (1-3)",
    subjects: ["English", "Mathematics", "Sciences", "Humanities", "Languages", "Arts & Technology"],
    transcriptFormat: "anz",
  },
  
  ib: {
    id: "ib",
    name: "International Baccalaureate",
    shortName: "IB Diploma / MYP",
    description: "IB Diploma Programme and Middle Years Programme with ATL skills",
    flag: "🌍",
    icon: "Globe2",
    tooltip: "IB Diploma (ages 16-19) with 6 subject groups + TOK, EE, CAS. MYP (ages 11-16) with interdisciplinary learning. Focus on Approaches to Learning (ATL) skills.",
    creditUnit: "points",
    creditLabel: "IB Points (max 45)",
    gradeTerminology: "IB Score (1-7 per subject, max 45 total)",
    subjects: [
      "Group 1: Studies in Language & Literature",
      "Group 2: Language Acquisition",
      "Group 3: Individuals & Societies",
      "Group 4: Sciences",
      "Group 5: Mathematics",
      "Group 6: Arts (or additional from Groups 1-5)",
    ],
    transcriptFormat: "ib",
  },
  
  eu: {
    id: "eu",
    name: "Germany / France / EU",
    shortName: "Abitur / Baccalauréat",
    description: "European qualifications: Abitur (Germany), Baccalauréat (France), and competency-based frameworks",
    flag: "🇪🇺",
    icon: "Languages",
    tooltip: "European education frameworks: German Abitur with Kompetenzbereiche, French Baccalauréat, or EU competency-based portfolios. Focus on holistic skill development.",
    creditUnit: "competencies",
    creditLabel: "Competency Areas",
    gradeTerminology: "Points / Grades (varies by country)",
    subjects: ["Native Language", "Foreign Languages", "Mathematics", "Sciences", "Social Sciences", "Arts"],
    transcriptFormat: "eu",
  },
  
  classical: {
    id: "classical",
    name: "Classical / Charlotte Mason",
    shortName: "Portfolio Style",
    description: "Narrative portfolio without formal credits - focuses on mastery and depth",
    flag: "📚",
    icon: "BookMarked",
    tooltip: "Classical education or Charlotte Mason approach with narrative assessments. No formal credits - uses portfolio evidence, narrations, and mastery demonstrations for university applications.",
    creditUnit: "competencies",
    creditLabel: "Areas of Study",
    gradeTerminology: "Narrative Assessment / Mastery",
    subjects: ["Language Arts", "Mathematics", "Sciences", "History", "Languages", "Fine Arts"],
    transcriptFormat: "narrative",
  },
  
  custom: {
    id: "custom",
    name: "Custom / Other Country",
    shortName: "Custom Framework",
    description: "Flexible framework for countries not listed - we'll adapt to your requirements",
    flag: "🌏",
    icon: "Settings",
    tooltip: "Custom framework for any country or approach not listed above. We support 50+ countries - the system will adapt to your specific requirements and terminology.",
    creditUnit: "units",
    creditLabel: "Learning Units",
    gradeTerminology: "Assessment (varies)",
    subjects: ["Core Subjects", "Electives"],
    transcriptFormat: "us", // Default to US-style format
  },
};

// Helper to get standard config
export function getStandardConfig(standard: EducationStandard | string | null | undefined): StandardConfig {
  const key = (standard || "us") as EducationStandard;
  return STANDARDS_CONFIG[key] || STANDARDS_CONFIG.us;
}

// Helper to get progress terminology
export function getProgressLabel(standard: EducationStandard | string | null | undefined): {
  creditUnit: string;
  creditLabel: string;
  gradeTerminology: string;
} {
  const config = getStandardConfig(standard);
  return {
    creditUnit: config.creditUnit,
    creditLabel: config.creditLabel,
    gradeTerminology: config.gradeTerminology,
  };
}

// Helper to get subject list for a standard
export function getSubjectsForStandard(standard: EducationStandard | string | null | undefined): string[] {
  const config = getStandardConfig(standard);
  return config.subjects;
}
