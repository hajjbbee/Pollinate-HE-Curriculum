import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  real,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Families table
export const families = pgTable("families", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  familyName: varchar("family_name").notNull(),
  country: varchar("country", { length: 2 }).notNull(), // ISO 3166-1 alpha-2 (e.g., US, AU, GB, NZ, CA, IN, ZA)
  locale: varchar("locale", { length: 10 }).notNull().default('en-AU'), // Language/region code (en-AU, en-US, en-GB, etc.)
  measurementSystem: varchar("measurement_system", { length: 10 }).notNull().default('metric'), // "metric" or "imperial"
  timezone: varchar("timezone", { length: 50 }), // IANA timezone (e.g., "Australia/Sydney", "America/New_York")
  address: text("address").notNull(),
  city: varchar("city"),
  state: varchar("state"),
  postalCode: varchar("postal_code"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  travelRadiusMinutes: integer("travel_radius_minutes").notNull().default(30),
  flexForHighInterest: boolean("flex_for_high_interest").notNull().default(true),
  lastEventsFetchedAt: timestamp("last_events_fetched_at"), // Global cache timestamp for API events
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Learning approaches (pedagogies) that can be selected
export const learningApproaches = [
  "charlotte-mason",
  "montessori",
  "waldorf",
  "unschooling",
  "project-based",
  "classical",
  "eclectic",
  "perfect-blend"
] as const;

export type LearningApproach = typeof learningApproaches[number];

// Education standards for High School Mode international support
export const educationStandards = [
  "us",
  "canada",
  "uk",
  "australia-nz",
  "ib",
  "eu",
  "classical",
  "custom"
] as const;

export type EducationStandard = typeof educationStandards[number];

// Family learning approach preferences
export const familyApproaches = pgTable("family_approaches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().unique().references(() => families.id, { onDelete: "cascade" }),
  approach: varchar("approach").notNull(), // Selected pedagogy: "perfect-blend", "charlotte-mason", "montessori", etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Children table
export const children = pgTable("children", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  birthdate: date("birthdate").notNull(),
  interests: text("interests").array().notNull().default(sql`ARRAY[]::text[]`),
  learningStyle: varchar("learning_style"),
  
  // Learning Needs & Neurodivergent Profiles
  hasAdhd: boolean("has_adhd").notNull().default(false),
  adhdIntensity: integer("adhd_intensity").default(0), // 0-10 scale
  hasAutism: boolean("has_autism").notNull().default(false),
  autismIntensity: integer("autism_intensity").default(0), // 0-10 scale
  sensoryProfile: varchar("sensory_profile"), // "seeking", "avoiding", "mixed", null
  isGifted: boolean("is_gifted").notNull().default(false),
  is2e: boolean("is_2e").notNull().default(false), // Twice exceptional (gifted + learning difference)
  hasDyslexia: boolean("has_dyslexia").notNull().default(false),
  dyslexiaIntensity: integer("dyslexia_intensity").default(0), // 0-10 scale
  hasDysgraphia: boolean("has_dysgraphia").notNull().default(false),
  dysgraphiaIntensity: integer("dysgraphia_intensity").default(0), // 0-10 scale
  hasDyscalculia: boolean("has_dyscalculia").notNull().default(false),
  dyscalculiaIntensity: integer("dyscalculia_intensity").default(0), // 0-10 scale
  hasAnxiety: boolean("has_anxiety").notNull().default(false),
  anxietyIntensity: integer("anxiety_intensity").default(0), // 0-10 scale
  isPerfectionist: boolean("is_perfectionist").notNull().default(false),
  
  // High School Mode (ages 12+)
  isHighSchoolMode: boolean("is_high_school_mode").notNull().default(false),
  educationStandard: varchar("education_standard").default("us"), // us, canada, uk, australia-nz, ib, eu, classical, custom
  standardMetadata: jsonb("standard_metadata"), // Flexible JSON for edge cases and standard-specific data
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Child-specific learning approach overrides (Future feature - not yet implemented)
// export const childApproaches = pgTable("child_approaches", {
//   id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
//   childId: varchar("child_id").notNull().unique().references(() => children.id, { onDelete: "cascade" }),
//   approach: varchar("approach").notNull(), // Per-child pedagogy override if different from family
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow(),
// });

// High School Transcript Courses
export const transcriptCourses = pgTable("transcript_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  courseTitle: varchar("course_title").notNull(), // e.g., "English 9: Literature & Composition"
  subject: varchar("subject").notNull(), // "english", "math", "science", "history", "elective", etc.
  gradeLevel: varchar("grade_level").notNull(), // "9", "10", "11", "12"
  credits: real("credits").notNull().default(1.0), // Standard credits (0.5 = semester, 1.0 = year)
  grade: varchar("grade"), // "A", "A-", "B+", "B", "Pass", etc.
  courseDescription: text("course_description"), // College-board style description generated from activities
  startDate: date("start_date"),
  endDate: date("end_date"),
  isComplete: boolean("is_complete").notNull().default(false),
  
  // International Standards Support
  gcseLevel: varchar("gcse_level"), // UK: "Foundation", "Higher", null
  ibGroup: varchar("ib_group"), // IB: "1-Studies in Language", "2-Language Acquisition", etc.
  nceaLevel: varchar("ncea_level"), // Australia/NZ: "Level 1", "Level 2", "Level 3"
  competencyTags: text("competency_tags").array(), // EU: Competency areas
  standardExtras: jsonb("standard_extras"), // Flexible JSON for future standard-specific fields
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit Mappings - Maps curriculum activities to academic credits
export const creditMappings = pgTable("credit_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  curriculumId: varchar("curriculum_id").references(() => curricula.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  activityTitle: text("activity_title").notNull(), // Activity from curriculum
  subject: varchar("subject").notNull(), // "english", "math", "science", "history", "elective"
  creditAmount: real("credit_amount").notNull(), // 0.25, 0.5, 1.0, etc.
  isEdited: boolean("is_edited").notNull().default(false), // True if mum manually adjusted
  courseId: varchar("course_id").references(() => transcriptCourses.id, { onDelete: "set null" }), // Link to transcript course
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Curricula table (stores generated 12-week curricula)
export const curricula = pgTable("curricula", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at").notNull(),
  curriculumData: jsonb("curriculum_data").notNull(), // Full JSON from AI
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Journal entries table
export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  entryDate: date("entry_date").notNull(),
  content: text("content").notNull(),
  photoUrls: text("photo_urls").array().default(sql`ARRAY[]::text[]`),
  audioUrl: text("audio_url"), // Voice recording URL from object storage
  audioDuration: integer("audio_duration"), // Duration in seconds
  aiFollowUpQuestions: text("ai_follow_up_questions").array(), // AI-generated reflection questions
  followUpAnswers: text("follow_up_answers").array(), // Mum's answers to follow-up questions
  aiAnalysis: jsonb("ai_analysis"), // Structured AI analysis: { summary, interests[], skills[], enthusiasm, notes }
  subjects: text("subjects").array().default(sql`ARRAY[]::text[]`), // Subject tags for portfolio tracking (Math, Reading, Science, etc.)
  elapsedMinutes: integer("elapsed_minutes"), // Time spent on this activity (for hour tracking)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Local opportunities cache table
export const localOpportunities = pgTable("local_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  driveMinutes: integer("drive_minutes"),
  cost: varchar("cost"),
  category: varchar("category"),
  placeId: varchar("place_id"),
  phone: varchar("phone"),
  website: text("website"),
  cachedAt: timestamp("cached_at").defaultNow(),
});

// Subscriptions table
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().unique().references(() => families.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripePriceId: varchar("stripe_price_id"),
  status: varchar("status").notNull().default("inactive"), // active, inactive, canceled, past_due
  plan: varchar("plan").notNull().default("basic"), // basic, pro
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Homeschool groups table
export const homeschoolGroups = pgTable("homeschool_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  groupId: varchar("group_id").notNull(), // Extracted from Facebook URL
  groupName: varchar("group_name").notNull(),
  groupUrl: text("group_url").notNull(),
  syncStatus: varchar("sync_status").notNull().default("pending"), // pending, syncing, synced, error
  lastSyncedAt: timestamp("last_synced_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily activity completions table (for streak tracking)
export const dailyCompletions = pgTable("daily_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  completionDate: date("completion_date").notNull(),
  activitiesCompleted: integer("activities_completed").notNull().default(0),
  totalActivities: integer("total_activities").notNull().default(0),
  completedIds: text("completed_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity feedback table (emoji reactions, voice notes, photos for planned activities)
export const activityFeedback = pgTable("activity_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  activityId: varchar("activity_id").notNull(), // Reference to activity in curriculum (e.g., "family-activity", "child-{id}")
  activityDate: date("activity_date").notNull(),
  reaction: varchar("reaction", { enum: ["loved", "okay", "not_today"] }), // 🌟, 🙂, 😅
  notes: text("notes"),
  voiceNoteUrl: text("voice_note_url"),
  photoUrl: text("photo_url"),
  followUpQuestion: text("follow_up_question"), // AI-generated question
  followUpResponse: boolean("follow_up_response"), // true = Yes, false = No, null = not answered
  obsessionScore: integer("obsession_score").default(0), // AI-calculated score
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("activity_feedback_unique").on(table.childId, table.activityId, table.activityDate),
]);

// Emerging interest signals table (free-form spontaneous obsessions)
export const emergingInterestSignals = pgTable("emerging_interest_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  source: varchar("source", { enum: ["free_form", "ai_followup"] }).notNull().default("free_form"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  voiceNoteUrl: text("voice_note_url"),
  photoUrl: text("photo_url"),
  priorityScore: integer("priority_score").notNull().default(100), // High = 100, treat as HIGH signal
  scheduled: boolean("scheduled").notNull().default(false), // true = added to curriculum
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Upcoming events table (from Eventbrite, Google Places, Facebook Groups)
export const upcomingEvents = pgTable("upcoming_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  eventName: varchar("event_name").notNull(),
  eventDate: timestamp("event_date").notNull(),
  endDate: timestamp("end_date"),
  location: text("location").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  driveMinutes: integer("drive_minutes"),
  cost: varchar("cost").notNull(), // "FREE", "$10", "$5-15", etc.
  ageRange: varchar("age_range"), // "5-12", "All ages", etc.
  category: varchar("category").notNull(), // "education", "science", "art", "history", etc.
  description: text("description"),
  whyItFits: text("why_it_fits"), // One-sentence explanation
  ticketUrl: text("ticket_url"),
  source: varchar("source").notNull(), // "api", "facebook_group"
  externalId: varchar("external_id"), // ID from source API
  groupId: varchar("group_id"), // For facebook_group events
  groupName: varchar("group_name"), // For facebook_group events  
  cachedAt: timestamp("cached_at").defaultNow(),
});

// Support tickets table
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => families.id, { onDelete: "cascade" }),
  userEmail: varchar("user_email").notNull(),
  userName: varchar("user_name").notNull(),
  message: text("message").notNull(),
  screenshotUrl: text("screenshot_url"),
  status: varchar("status").notNull().default("new"), // new, replied, resolved
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// State requirements lookup table (static data for compliance)
export const stateRequirements = pgTable("state_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateCode: varchar("state_code", { length: 10 }).notNull().unique(), // e.g., "NSW", "VIC", "CA", "TX"
  stateName: varchar("state_name").notNull(), // e.g., "New South Wales", "California"
  countryCode: varchar("country_code", { length: 2 }).notNull(), // e.g., "AU", "US"
  minimumDaysPerYear: integer("minimum_days_per_year"), // e.g., 180
  minimumHoursPerYear: integer("minimum_hours_per_year"), // e.g., 900
  requiredSubjects: jsonb("required_subjects").notNull(), // Array of {subject: string, hoursPerYear: number}
  portfolioRequired: boolean("portfolio_required").notNull().default(false),
  affidavitText: text("affidavit_text"), // Pre-filled affidavit statement
  additionalNotes: text("additional_notes"), // Special requirements or notes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Child portfolio years (per child/year configuration for compliance tracking)
export const childPortfolioYears = pgTable("child_portfolio_years", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  academicYear: varchar("academic_year").notNull(), // e.g., "2024-2025"
  stateRequirementId: varchar("state_requirement_id").references(() => stateRequirements.id),
  customSubjects: jsonb("custom_subjects"), // Optional: Override/add subjects beyond state requirements
  guardianSignature: text("guardian_signature"), // Base64 signature image
  signatureDate: date("signature_date"),
  coverPhotoUrl: text("cover_photo_url"), // Optional child photo for portfolio cover
  notes: text("notes"), // General notes for this academic year
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("child_year_unique").on(table.childId, table.academicYear),
]);

// Portfolio entries (weekly tracking aggregates)
export const portfolioEntries = pgTable("portfolio_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioYearId: varchar("portfolio_year_id").notNull().references(() => childPortfolioYears.id, { onDelete: "cascade" }),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  weekStartDate: date("week_start_date").notNull(),
  weekEndDate: date("week_end_date").notNull(),
  subjectHours: jsonb("subject_hours").notNull(), // {Math: 5, Reading: 3, Science: 2, ...}
  attendanceDays: integer("attendance_days").notNull().default(0), // Days attended this week
  narrationSamples: text("narration_samples").array().default(sql`ARRAY[]::text[]`), // Text narrations
  masteryNotes: text("mastery_notes"), // Notes about mastery/progress this week
  linkedJournalIds: text("linked_journal_ids").array().default(sql`ARRAY[]::text[]`), // References to journal entries
  highlightPhotoUrls: text("highlight_photo_urls").array().default(sql`ARRAY[]::text[]`), // Best photos from this week
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("portfolio_week_unique").on(table.childId, table.weekStartDate),
]);

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  family: one(families, {
    fields: [users.id],
    references: [families.userId],
  }),
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
  user: one(users, {
    fields: [families.userId],
    references: [users.id],
  }),
  children: many(children),
  curricula: many(curricula),
  journalEntries: many(journalEntries),
  localOpportunities: many(localOpportunities),
  upcomingEvents: many(upcomingEvents),
  homeschoolGroups: many(homeschoolGroups),
  supportTickets: many(supportTickets),
  subscription: one(subscriptions, {
    fields: [families.id],
    references: [subscriptions.familyId],
  }),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  family: one(families, {
    fields: [children.familyId],
    references: [families.id],
  }),
  journalEntries: many(journalEntries),
}));

export const curriculaRelations = relations(curricula, ({ one }) => ({
  family: one(families, {
    fields: [curricula.familyId],
    references: [families.id],
  }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  child: one(children, {
    fields: [journalEntries.childId],
    references: [children.id],
  }),
  family: one(families, {
    fields: [journalEntries.familyId],
    references: [families.id],
  }),
}));

export const localOpportunitiesRelations = relations(localOpportunities, ({ one }) => ({
  family: one(families, {
    fields: [localOpportunities.familyId],
    references: [families.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  family: one(families, {
    fields: [subscriptions.familyId],
    references: [families.id],
  }),
}));

export const upcomingEventsRelations = relations(upcomingEvents, ({ one }) => ({
  family: one(families, {
    fields: [upcomingEvents.familyId],
    references: [families.id],
  }),
}));

export const homeschoolGroupsRelations = relations(homeschoolGroups, ({ one }) => ({
  family: one(families, {
    fields: [homeschoolGroups.familyId],
    references: [families.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  family: one(families, {
    fields: [supportTickets.familyId],
    references: [families.id],
  }),
}));

// Insert schemas
export const insertFamilySchema = createInsertSchema(families).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChildSchema = createInsertSchema(children).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sensoryProfile: true, // Deprecated field - no longer collected via UI
}).extend({
  educationStandard: z.enum(educationStandards).optional().default("us"),
});

export const insertTranscriptCourseSchema = createInsertSchema(transcriptCourses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditMappingSchema = createInsertSchema(creditMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCurriculumSchema = createInsertSchema(curricula).omit({
  id: true,
  createdAt: true,
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityFeedbackSchema = createInsertSchema(activityFeedback).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmergingInterestSignalSchema = createInsertSchema(emergingInterestSignals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLocalOpportunitySchema = createInsertSchema(localOpportunities).omit({
  id: true,
  cachedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUpcomingEventSchema = createInsertSchema(upcomingEvents).omit({
  id: true,
  cachedAt: true,
});

export const insertHomeschoolGroupSchema = createInsertSchema(homeschoolGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyApproachSchema = createInsertSchema(familyApproaches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStateRequirementSchema = createInsertSchema(stateRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChildPortfolioYearSchema = createInsertSchema(childPortfolioYears).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioEntrySchema = createInsertSchema(portfolioEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Future feature - commented out until per-child overrides are implemented
// export const insertChildApproachSchema = createInsertSchema(childApproaches).omit({
//   id: true,
//   createdAt: true,
//   updatedAt: true,
// });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;

export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof children.$inferSelect;

export type InsertTranscriptCourse = z.infer<typeof insertTranscriptCourseSchema>;
export type TranscriptCourse = typeof transcriptCourses.$inferSelect;

export type InsertCreditMapping = z.infer<typeof insertCreditMappingSchema>;
export type CreditMapping = typeof creditMappings.$inferSelect;

export type InsertCurriculum = z.infer<typeof insertCurriculumSchema>;
export type Curriculum = typeof curricula.$inferSelect;

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

export type InsertActivityFeedback = z.infer<typeof insertActivityFeedbackSchema>;
export type ActivityFeedback = typeof activityFeedback.$inferSelect;

export type InsertEmergingInterestSignal = z.infer<typeof insertEmergingInterestSignalSchema>;
export type EmergingInterestSignal = typeof emergingInterestSignals.$inferSelect;

export type InsertLocalOpportunity = z.infer<typeof insertLocalOpportunitySchema>;
export type LocalOpportunity = typeof localOpportunities.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export type InsertUpcomingEvent = z.infer<typeof insertUpcomingEventSchema>;
export type UpcomingEvent = typeof upcomingEvents.$inferSelect;

export type InsertHomeschoolGroup = z.infer<typeof insertHomeschoolGroupSchema>;
export type HomeschoolGroup = typeof homeschoolGroups.$inferSelect;

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export type InsertFamilyApproach = z.infer<typeof insertFamilyApproachSchema>;
export type FamilyApproach = typeof familyApproaches.$inferSelect;

export type InsertStateRequirement = z.infer<typeof insertStateRequirementSchema>;
export type StateRequirement = typeof stateRequirements.$inferSelect;

export type InsertChildPortfolioYear = z.infer<typeof insertChildPortfolioYearSchema>;
export type ChildPortfolioYear = typeof childPortfolioYears.$inferSelect;

export type InsertPortfolioEntry = z.infer<typeof insertPortfolioEntrySchema>;
export type PortfolioEntry = typeof portfolioEntries.$inferSelect;

// Future feature types - commented out until per-child overrides are implemented
// export type InsertChildApproach = z.infer<typeof insertChildApproachSchema>;
// export type ChildApproach = typeof childApproaches.$inferSelect;

// Zod schemas for AI curriculum response validation
export const confidenceExampleSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(10),
  ageRange: z.string().optional(),
  pedagogy: z.string().optional(),
});

export const activityWithExamplesSchema = z.object({
  activity: z.string().min(1),
  examples: z.object({
    quickEasy: confidenceExampleSchema,
    mediumAdventure: confidenceExampleSchema,
    deepDive: confidenceExampleSchema,
  }).optional(),
});

export const dailyActivitySchema = z.union([
  z.string().min(1),
  activityWithExamplesSchema,
]);

export const weekActivitySchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  driveMinutes: z.number().int().min(0).max(180),
  cost: z.string().min(1),
  why: z.string().min(1),
  link: z.string().url().nullable(),
  dates: z.string().min(1),
});

export const resourceSchema = z.object({
  title: z.string().min(1),
  link: z.string().url().optional(),
  description: z.string().min(1),
  category: z.enum(["free", "low-cost", "recycled"]),
});

export const childWeekPlanSchema = z.object({
  childId: z.string().uuid(),
  name: z.string().min(1),
  age: z.number().int().min(0).max(25),
  deepDives: z.array(z.string()).min(1).max(5),
  dailyPlan: z.object({
    Monday: z.array(dailyActivitySchema).min(0).max(10),
    Tuesday: z.array(dailyActivitySchema).min(0).max(10),
    Wednesday: z.array(dailyActivitySchema).min(0).max(10),
    Thursday: z.array(dailyActivitySchema).min(0).max(10),
    Friday: z.array(dailyActivitySchema).min(0).max(10),
    Weekend: z.string(),
  }),
  masteryUpdates: z.record(z.string(), z.string()),
});

export const weekCurriculumSchema = z.object({
  weekNumber: z.number().int().min(1).max(12),
  familyTheme: z.string().min(1),
  familyActivities: z.array(z.string()).min(0).max(10),
  localOpportunities: z.array(weekActivitySchema).min(0).max(25),
  children: z.array(childWeekPlanSchema).min(1),
  resources: z.array(resourceSchema).min(0).max(20),
});

export const curriculumDataSchema = z.object({
  generatedAt: z.string().datetime(),
  weeks: z.array(weekCurriculumSchema).length(12),
});

// Curriculum JSON structure types
export interface WeekActivity {
  name: string;
  address: string;
  driveMinutes: number;
  cost: string;
  why: string;
  link: string | null;
  dates: string;
}

export interface ConfidenceExample {
  title: string;
  description: string;
  ageRange?: string;
  pedagogy?: string; // e.g., "🎲 Gameschooling", "🍃 Nature/Waldorf", "⭐ Steiner", "🎨 Art/STEAM", "🔍 Inquiry"
}

export interface ActivityWithExamples {
  activity: string;
  examples?: {
    quickEasy: ConfidenceExample;
    mediumAdventure: ConfidenceExample;
    deepDive: ConfidenceExample;
  };
}

export type DailyActivity = string | ActivityWithExamples;

export interface ChildWeekPlan {
  childId: string;
  name: string;
  age: number;
  deepDives: string[];
  dailyPlan: {
    Monday: DailyActivity[];
    Tuesday: DailyActivity[];
    Wednesday: DailyActivity[];
    Thursday: DailyActivity[];
    Friday: DailyActivity[];
    Weekend: string;
  };
  masteryUpdates: Record<string, string>;
}

export interface Resource {
  title: string;
  link?: string;
  description: string;
  category: "free" | "low-cost" | "recycled";
}

export interface WeekCurriculum {
  weekNumber: number;
  familyTheme: string;
  familyActivities: string[];
  localOpportunities: WeekActivity[];
  children: ChildWeekPlan[];
  resources: Resource[];
}

export interface CurriculumData {
  generatedAt: string;
  weeks: WeekCurriculum[];
}
