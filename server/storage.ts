import type {
  InsertFamily,
  Family,
  InsertChild,
  Child,
  InsertCurriculum,
  Curriculum,
  InsertJournalEntry,
  JournalEntry,
  InsertLocalOpportunity,
  LocalOpportunity,
  InsertSubscription,
  Subscription,
  User,
  UpsertUser,
} from "@shared/schema";

export interface IStorage {
  // User (for authentication)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Family
  createFamily(family: InsertFamily): Promise<Family>;
  getFamily(userId: string): Promise<Family | null>;
  updateFamily(userId: string, updates: Partial<InsertFamily>): Promise<Family>;

  // Children
  createChild(child: InsertChild): Promise<Child>;
  getChildren(familyId: string): Promise<Child[]>;
  getChildById(childId: string): Promise<Child | null>;
  updateChild(childId: string, updates: Partial<InsertChild>): Promise<Child>;
  deleteChild(childId: string): Promise<void>;

  // Curriculum
  createCurriculum(curriculum: InsertCurriculum): Promise<Curriculum>;
  getActiveCurriculum(familyId: string): Promise<Curriculum | null>;
  getAllCurricula(familyId: string): Promise<Curriculum[]>;
  deactivateAllCurricula(familyId: string): Promise<void>;

  // Journal Entries
  createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  getJournalEntries(familyId: string): Promise<JournalEntry[]>;
  getJournalEntriesByChild(childId: string): Promise<JournalEntry[]>;
  updateJournalEntry(entryId: string, updates: Partial<InsertJournalEntry>): Promise<JournalEntry>;
  deleteJournalEntry(entryId: string): Promise<void>;

  // Local Opportunities
  createOpportunity(opportunity: InsertLocalOpportunity): Promise<LocalOpportunity>;
  getOpportunities(familyId: string): Promise<LocalOpportunity[]>;
  deleteOpportunitiesByFamily(familyId: string): Promise<void>;

  // Subscriptions
  upsertSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscription(familyId: string): Promise<Subscription | null>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
  getSubscriptionByCustomerId(stripeCustomerId: string): Promise<Subscription | null>;
  updateSubscription(familyId: string, updates: Partial<InsertSubscription>): Promise<Subscription>;
  updateSubscriptionByStripeId(stripeSubscriptionId: string, updates: Partial<InsertSubscription>): Promise<Subscription | null>;
}

import { db } from "./db";
import {
  users,
  families,
  children,
  curricula,
  journalEntries,
  localOpportunities,
  subscriptions,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // User (for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Family
  async createFamily(family: InsertFamily): Promise<Family> {
    const [result] = await db.insert(families).values(family).returning();
    return result;
  }

  async getFamily(userId: string): Promise<Family | null> {
    const [result] = await db.select().from(families).where(eq(families.userId, userId));
    return result || null;
  }

  async updateFamily(userId: string, updates: Partial<InsertFamily>): Promise<Family> {
    const [result] = await db
      .update(families)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(families.userId, userId))
      .returning();
    return result;
  }

  // Children
  async createChild(child: InsertChild): Promise<Child> {
    const [result] = await db.insert(children).values(child).returning();
    return result;
  }

  async getChildren(familyId: string): Promise<Child[]> {
    return await db.select().from(children).where(eq(children.familyId, familyId));
  }

  async getChildById(childId: string): Promise<Child | null> {
    const [result] = await db.select().from(children).where(eq(children.id, childId));
    return result || null;
  }

  async updateChild(childId: string, updates: Partial<InsertChild>): Promise<Child> {
    const [result] = await db
      .update(children)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(children.id, childId))
      .returning();
    return result;
  }

  async deleteChild(childId: string): Promise<void> {
    await db.delete(children).where(eq(children.id, childId));
  }

  // Curriculum
  async createCurriculum(curriculum: InsertCurriculum): Promise<Curriculum> {
    const [result] = await db.insert(curricula).values(curriculum).returning();
    return result;
  }

  async getActiveCurriculum(familyId: string): Promise<Curriculum | null> {
    const [result] = await db
      .select()
      .from(curricula)
      .where(and(eq(curricula.familyId, familyId), eq(curricula.isActive, true)))
      .orderBy(desc(curricula.generatedAt));
    return result || null;
  }

  async getAllCurricula(familyId: string): Promise<Curriculum[]> {
    return await db
      .select()
      .from(curricula)
      .where(eq(curricula.familyId, familyId))
      .orderBy(desc(curricula.generatedAt));
  }

  async deactivateAllCurricula(familyId: string): Promise<void> {
    await db
      .update(curricula)
      .set({ isActive: false })
      .where(eq(curricula.familyId, familyId));
  }

  // Journal Entries
  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const [result] = await db.insert(journalEntries).values(entry).returning();
    return result;
  }

  async getJournalEntries(familyId: string): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.familyId, familyId))
      .orderBy(desc(journalEntries.entryDate));
  }

  async getJournalEntriesByChild(childId: string): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.childId, childId))
      .orderBy(desc(journalEntries.entryDate));
  }

  async updateJournalEntry(entryId: string, updates: Partial<InsertJournalEntry>): Promise<JournalEntry> {
    const [result] = await db
      .update(journalEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(journalEntries.id, entryId))
      .returning();
    return result;
  }

  async deleteJournalEntry(entryId: string): Promise<void> {
    await db.delete(journalEntries).where(eq(journalEntries.id, entryId));
  }

  // Local Opportunities
  async createOpportunity(opportunity: InsertLocalOpportunity): Promise<LocalOpportunity> {
    const [result] = await db.insert(localOpportunities).values(opportunity).returning();
    return result;
  }

  async getOpportunities(familyId: string): Promise<LocalOpportunity[]> {
    return await db
      .select()
      .from(localOpportunities)
      .where(eq(localOpportunities.familyId, familyId))
      .orderBy(localOpportunities.driveMinutes);
  }

  async deleteOpportunitiesByFamily(familyId: string): Promise<void> {
    await db.delete(localOpportunities).where(eq(localOpportunities.familyId, familyId));
  }

  // Subscriptions
  async upsertSubscription(subscriptionData: InsertSubscription): Promise<Subscription> {
    const [result] = await db
      .insert(subscriptions)
      .values(subscriptionData)
      .onConflictDoUpdate({
        target: subscriptions.familyId,
        set: { ...subscriptionData, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  async getSubscription(familyId: string): Promise<Subscription | null>;
  async getSubscription(customerId: string): Promise<Subscription | null>;
  async getSubscription(idOrCustomer: string): Promise<Subscription | null> {
    // Try familyId first
    let [result] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.familyId, idOrCustomer));
    
    // If not found, try stripeCustomerId
    if (!result) {
      [result] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeCustomerId, idOrCustomer));
    }
    
    return result || null;
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const [result] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return result || null;
  }

  async getSubscriptionByCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    const [result] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
    return result || null;
  }

  async updateSubscription(familyId: string, updates: Partial<InsertSubscription>): Promise<Subscription> {
    const [result] = await db
      .update(subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptions.familyId, familyId))
      .returning();
    return result;
  }

  async updateSubscriptionByStripeId(stripeSubscriptionId: string, updates: Partial<InsertSubscription>): Promise<Subscription | null> {
    const [result] = await db
      .update(subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .returning();
    return result || null;
  }
}

export const storage = new DatabaseStorage();
