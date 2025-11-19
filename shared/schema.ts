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
  country: varchar("country", { length: 2 }).notNull(), // US, AU, NZ
  address: text("address").notNull(),
  city: varchar("city"),
  state: varchar("state"),
  postalCode: varchar("postal_code"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  travelRadiusMinutes: integer("travel_radius_minutes").notNull().default(30),
  flexForHighInterest: boolean("flex_for_high_interest").notNull().default(true),
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

export const insertLocalOpportunitySchema = createInsertSchema(localOpportunities).omit({
  id: true,
  cachedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;

export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof children.$inferSelect;

export type InsertCurriculum = z.infer<typeof insertCurriculumSchema>;
export type Curriculum = typeof curricula.$inferSelect;

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

export type InsertLocalOpportunity = z.infer<typeof insertLocalOpportunitySchema>;
export type LocalOpportunity = typeof localOpportunities.$inferSelect;

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

export interface ChildWeekPlan {
  childId: string;
  name: string;
  age: number;
  deepDives: string[];
  dailyPlan: {
    Monday: string[];
    Tuesday: string[];
    Wednesday: string[];
    Thursday: string[];
    Friday: string[];
    Weekend: string;
  };
  masteryUpdates: Record<string, string>;
}

export interface WeekCurriculum {
  weekNumber: number;
  familyTheme: string;
  familyActivities: string[];
  localOpportunities: WeekActivity[];
  children: ChildWeekPlan[];
}

export interface CurriculumData {
  generatedAt: string;
  weeks: WeekCurriculum[];
}
