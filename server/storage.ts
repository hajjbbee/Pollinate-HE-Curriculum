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
  InsertUpcomingEvent,
  UpcomingEvent,
  InsertHomeschoolGroup,
  HomeschoolGroup,
  InsertActivityFeedback,
  ActivityFeedback,
  InsertEmergingInterestSignal,
  EmergingInterestSignal,
  InsertSupportTicket,
  SupportTicket,
  InsertFamilyApproach,
  FamilyApproach,
  // Child approaches removed - future feature
  // InsertChildApproach,
  // ChildApproach,
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

  // Upcoming Events
  createEvent(event: InsertUpcomingEvent): Promise<UpcomingEvent>;
  getUpcomingEvents(familyId: string, startDate?: Date, endDate?: Date): Promise<UpcomingEvent[]>;
  deleteEvent(eventId: string): Promise<void>;
  deleteEventsByFamily(familyId: string): Promise<void>;
  deleteEventsBySource(familyId: string, source: string): Promise<void>;
  deleteOldEvents(beforeDate: Date): Promise<void>;

  // Homeschool Groups
  createHomeschoolGroup(group: InsertHomeschoolGroup): Promise<HomeschoolGroup>;
  getHomeschoolGroups(familyId: string): Promise<HomeschoolGroup[]>;
  getHomeschoolGroupById(groupId: string): Promise<HomeschoolGroup | null>;
  updateHomeschoolGroup(groupId: string, updates: Partial<InsertHomeschoolGroup>): Promise<HomeschoolGroup>;
  deleteHomeschoolGroup(groupId: string): Promise<void>;

  // Subscriptions
  upsertSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscription(familyId: string): Promise<Subscription | null>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
  getSubscriptionByCustomerId(stripeCustomerId: string): Promise<Subscription | null>;
  updateSubscription(familyId: string, updates: Partial<InsertSubscription>): Promise<Subscription>;
  updateSubscriptionByStripeId(stripeSubscriptionId: string, updates: Partial<InsertSubscription>): Promise<Subscription | null>;
  updateFamilyEventsFetchedAt(familyId: string): Promise<void>;

  // Daily Completions (for streak tracking)
  upsertDailyCompletion(familyId: string, date: string, completed: number, total: number, completedIds: string[]): Promise<void>;
  getDailyCompletion(familyId: string, date: string): Promise<{ completed: number; total: number; completedIds: string[] } | null>;
  getDailyCompletions(familyId: string, startDate?: Date, endDate?: Date): Promise<any[]>;
  getCurrentStreak(familyId: string): Promise<number>;

  // Activity Feedback (emoji reactions, voice notes, photos for planned activities)
  createActivityFeedback(feedback: InsertActivityFeedback): Promise<ActivityFeedback>;
  getActivityFeedback(activityId: string, date: string): Promise<ActivityFeedback | null>;
  getActivityFeedbackByChild(childId: string, startDate?: Date, endDate?: Date): Promise<ActivityFeedback[]>;
  updateActivityFeedback(feedbackId: string, updates: Partial<InsertActivityFeedback>): Promise<ActivityFeedback>;
  deleteActivityFeedback(feedbackId: string): Promise<void>;

  // Emerging Interest Signals (free-form spontaneous obsessions)
  createEmergingInterest(signal: InsertEmergingInterestSignal): Promise<EmergingInterestSignal>;
  getEmergingInterests(childId: string, familyId?: string): Promise<EmergingInterestSignal[]>;
  getRecentEmergingInterests(childId: string, days?: number): Promise<EmergingInterestSignal[]>;
  updateEmergingInterest(signalId: string, updates: Partial<InsertEmergingInterestSignal>): Promise<EmergingInterestSignal>;
  deleteEmergingInterest(signalId: string): Promise<void>;

  // Support Tickets
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTickets(familyId: string): Promise<SupportTicket[]>;
  updateSupportTicket(ticketId: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket>;

  // Learning Approaches
  upsertFamilyApproach(approach: InsertFamilyApproach): Promise<FamilyApproach>;
  getFamilyApproach(familyId: string): Promise<FamilyApproach | null>;
  // Child approaches removed - future feature
  // upsertChildApproach(approach: InsertChildApproach): Promise<ChildApproach>;
  // getChildApproach(childId: string): Promise<ChildApproach | null>;
  // getChildApproaches(childIds: string[]): Promise<ChildApproach[]>;
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
  upcomingEvents,
  homeschoolGroups,
  dailyCompletions,
  activityFeedback,
  emergingInterestSignals,
  supportTickets,
  familyApproaches,
  childApproaches,
} from "@shared/schema";
import { eq, and, desc, gte, lte, sql as sqlOp, inArray } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // User (for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if user exists by email first (Replit OIDC may change sub but keep email)
    const existingUser = await db.query.users.findFirst({
      where: (usersTable, { eq: eqFn }) => eqFn(usersTable.email, userData.email),
    });

    if (existingUser) {
      // Update existing user with new data from OIDC (excluding id to prevent foreign key violations)
      const { id, ...updateData } = userData;
      const [user] = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.email, userData.email))
        .returning();
      return user;
    }

    // Insert new user if doesn't exist
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImage: userData.profileImage,
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

  // Upcoming Events
  async createEvent(event: InsertUpcomingEvent): Promise<UpcomingEvent> {
    const [result] = await db.insert(upcomingEvents).values(event).returning();
    return result;
  }

  async getUpcomingEvents(familyId: string, startDate?: Date, endDate?: Date): Promise<UpcomingEvent[]> {
    const conditions = [eq(upcomingEvents.familyId, familyId)];
    
    if (startDate && endDate) {
      conditions.push(
        gte(upcomingEvents.eventDate, startDate),
        lte(upcomingEvents.eventDate, endDate)
      );
    } else if (startDate) {
      conditions.push(gte(upcomingEvents.eventDate, startDate));
    }
    
    const results = await db
      .select()
      .from(upcomingEvents)
      .where(and(...conditions))
      .orderBy(upcomingEvents.eventDate);
    
    return results;
  }

  async deleteEvent(eventId: string): Promise<void> {
    await db.delete(upcomingEvents).where(eq(upcomingEvents.id, eventId));
  }

  async deleteEventsByFamily(familyId: string): Promise<void> {
    await db.delete(upcomingEvents).where(eq(upcomingEvents.familyId, familyId));
  }

  async deleteEventsBySource(familyId: string, source: string): Promise<void> {
    await db.delete(upcomingEvents).where(and(
      eq(upcomingEvents.familyId, familyId),
      eq(upcomingEvents.source, source)
    ));
  }

  async deleteOldEvents(beforeDate: Date): Promise<void> {
    await db.delete(upcomingEvents).where(lte(upcomingEvents.eventDate, beforeDate));
  }

  // Homeschool Groups
  async createHomeschoolGroup(group: InsertHomeschoolGroup): Promise<HomeschoolGroup> {
    const [result] = await db.insert(homeschoolGroups).values(group).returning();
    return result;
  }

  async getHomeschoolGroups(familyId: string): Promise<HomeschoolGroup[]> {
    return db.select().from(homeschoolGroups).where(eq(homeschoolGroups.familyId, familyId));
  }

  async getHomeschoolGroupById(groupId: string): Promise<HomeschoolGroup | null> {
    const [result] = await db.select().from(homeschoolGroups).where(eq(homeschoolGroups.id, groupId));
    return result || null;
  }

  async updateHomeschoolGroup(groupId: string, updates: Partial<InsertHomeschoolGroup>): Promise<HomeschoolGroup> {
    const [result] = await db
      .update(homeschoolGroups)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(homeschoolGroups.id, groupId))
      .returning();
    return result;
  }

  async deleteHomeschoolGroup(groupId: string): Promise<void> {
    await db.delete(homeschoolGroups).where(eq(homeschoolGroups.id, groupId));
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

  async updateFamilyEventsFetchedAt(familyId: string): Promise<void> {
    await db
      .update(families)
      .set({ lastEventsFetchedAt: new Date() })
      .where(eq(families.id, familyId));
  }

  // Daily Completions (for streak tracking)
  async upsertDailyCompletion(familyId: string, date: string, completed: number, total: number, completedIds: string[]): Promise<void> {
    // Check if entry exists for this family and date
    const existing = await db
      .select()
      .from(dailyCompletions)
      .where(and(
        eq(dailyCompletions.familyId, familyId),
        eq(dailyCompletions.completionDate, date)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing entry
      await db
        .update(dailyCompletions)
        .set({
          activitiesCompleted: completed,
          totalActivities: total,
          completedIds,
        })
        .where(and(
          eq(dailyCompletions.familyId, familyId),
          eq(dailyCompletions.completionDate, date)
        ));
    } else {
      // Insert new entry
      await db.insert(dailyCompletions).values({
        familyId,
        completionDate: date,
        activitiesCompleted: completed,
        totalActivities: total,
        completedIds,
      });
    }
  }

  async getDailyCompletion(familyId: string, date: string): Promise<{ completed: number; total: number; completedIds: string[] } | null> {
    const result = await db
      .select()
      .from(dailyCompletions)
      .where(and(
        eq(dailyCompletions.familyId, familyId),
        eq(dailyCompletions.completionDate, date)
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      completed: result[0].activitiesCompleted,
      total: result[0].totalActivities,
      completedIds: result[0].completedIds || [],
    };
  }

  async getDailyCompletions(familyId: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = db
      .select()
      .from(dailyCompletions)
      .where(eq(dailyCompletions.familyId, familyId));

    if (startDate && endDate) {
      query = query.where(and(
        eq(dailyCompletions.familyId, familyId),
        gte(dailyCompletions.completionDate, startDate.toISOString().split('T')[0]),
        lte(dailyCompletions.completionDate, endDate.toISOString().split('T')[0])
      ));
    }

    const results = await query.orderBy(desc(dailyCompletions.completionDate));
    return results;
  }

  async getCurrentStreak(familyId: string): Promise<number> {
    // Get completions for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const completions = await db
      .select()
      .from(dailyCompletions)
      .where(and(
        eq(dailyCompletions.familyId, familyId),
        gte(dailyCompletions.completionDate, startDate.toISOString().split('T')[0])
      ))
      .orderBy(desc(dailyCompletions.completionDate));

    if (completions.length === 0) return 0;

    // Calculate streak - count consecutive days with at least 1 activity completed
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const completion of completions) {
      const completionDate = new Date(completion.completionDate);
      completionDate.setHours(0, 0, 0, 0);
      
      const dayDiff = Math.floor((currentDate.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === streak) {
        // This is the next day in the streak
        if (completion.activitiesCompleted > 0) {
          streak++;
        } else {
          break; // Streak broken
        }
      } else if (dayDiff > streak) {
        // Gap in streak
        break;
      }
    }

    return streak;
  }

  // Activity Feedback (emoji reactions, voice notes, photos for planned activities)
  async createActivityFeedback(feedback: InsertActivityFeedback): Promise<ActivityFeedback> {
    // Fetch existing feedback to merge with new data (prevents data loss on partial updates)
    const existing = await db
      .select()
      .from(activityFeedback)
      .where(
        and(
          eq(activityFeedback.childId, feedback.childId),
          eq(activityFeedback.activityId, feedback.activityId),
          eq(activityFeedback.activityDate, feedback.activityDate)
        )
      )
      .limit(1);
    
    const existingRecord = existing[0];
    
    // Merge existing data with new data
    // undefined = preserve existing value, null = clear field, value = set new value
    const mergedData = {
      familyId: feedback.familyId,
      childId: feedback.childId,
      activityId: feedback.activityId,
      activityDate: feedback.activityDate,
      reaction: feedback.reaction !== undefined ? feedback.reaction : existingRecord?.reaction,
      notes: feedback.notes !== undefined ? feedback.notes : existingRecord?.notes,
      voiceNoteUrl: feedback.voiceNoteUrl !== undefined ? feedback.voiceNoteUrl : existingRecord?.voiceNoteUrl,
      photoUrl: feedback.photoUrl !== undefined ? feedback.photoUrl : existingRecord?.photoUrl,
      followUpQuestion: existingRecord?.followUpQuestion || null,
      followUpResponse: existingRecord?.followUpResponse !== undefined ? existingRecord.followUpResponse : null,
      obsessionScore: existingRecord?.obsessionScore || 0,
    };
    
    if (existingRecord) {
      // Update existing record
      const [result] = await db
        .update(activityFeedback)
        .set({
          ...mergedData,
          updatedAt: new Date(),
        })
        .where(eq(activityFeedback.id, existingRecord.id))
        .returning();
      return result;
    } else {
      // Insert new record
      const [result] = await db
        .insert(activityFeedback)
        .values({
          ...mergedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result;
    }
  }

  async getActivityFeedback(activityId: string, date: string): Promise<ActivityFeedback | null> {
    const result = await db
      .select()
      .from(activityFeedback)
      .where(and(
        eq(activityFeedback.activityId, activityId),
        eq(activityFeedback.activityDate, date)
      ))
      .limit(1);
    
    return result[0] || null;
  }

  async getActivityFeedbackByChild(childId: string, startDate?: Date, endDate?: Date): Promise<ActivityFeedback[]> {
    let query = db
      .select()
      .from(activityFeedback)
      .where(eq(activityFeedback.childId, childId));

    if (startDate && endDate) {
      query = query.where(and(
        eq(activityFeedback.childId, childId),
        gte(activityFeedback.activityDate, startDate.toISOString().split('T')[0]),
        lte(activityFeedback.activityDate, endDate.toISOString().split('T')[0])
      ));
    }

    return await query.orderBy(desc(activityFeedback.activityDate));
  }

  async updateActivityFeedback(feedbackId: string, updates: Partial<InsertActivityFeedback>): Promise<ActivityFeedback> {
    const [result] = await db
      .update(activityFeedback)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(activityFeedback.id, feedbackId))
      .returning();
    return result;
  }

  async deleteActivityFeedback(feedbackId: string): Promise<void> {
    await db.delete(activityFeedback).where(eq(activityFeedback.id, feedbackId));
  }

  // Emerging Interest Signals (free-form spontaneous obsessions)
  async createEmergingInterest(signal: InsertEmergingInterestSignal): Promise<EmergingInterestSignal> {
    const [result] = await db.insert(emergingInterestSignals).values(signal).returning();
    return result;
  }

  async getEmergingInterests(childId: string, familyId?: string): Promise<EmergingInterestSignal[]> {
    let query = db
      .select()
      .from(emergingInterestSignals)
      .where(eq(emergingInterestSignals.childId, childId));

    if (familyId) {
      query = query.where(and(
        eq(emergingInterestSignals.childId, childId),
        eq(emergingInterestSignals.familyId, familyId)
      ));
    }

    return await query.orderBy(desc(emergingInterestSignals.createdAt));
  }

  async getRecentEmergingInterests(childId: string, days: number = 30): Promise<EmergingInterestSignal[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await db
      .select()
      .from(emergingInterestSignals)
      .where(and(
        eq(emergingInterestSignals.childId, childId),
        gte(emergingInterestSignals.createdAt, cutoffDate)
      ))
      .orderBy(desc(emergingInterestSignals.createdAt));
  }

  async updateEmergingInterest(signalId: string, updates: Partial<InsertEmergingInterestSignal>): Promise<EmergingInterestSignal> {
    const [result] = await db
      .update(emergingInterestSignals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emergingInterestSignals.id, signalId))
      .returning();
    return result;
  }

  async deleteEmergingInterest(signalId: string): Promise<void> {
    await db.delete(emergingInterestSignals).where(eq(emergingInterestSignals.id, signalId));
  }

  // Support Tickets
  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const [result] = await db.insert(supportTickets).values(ticket).returning();
    return result;
  }

  async getSupportTickets(familyId: string): Promise<SupportTicket[]> {
    return await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.familyId, familyId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async updateSupportTicket(ticketId: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket> {
    const [result] = await db
      .update(supportTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    return result;
  }

  // Learning Approaches
  async upsertFamilyApproach(approach: InsertFamilyApproach): Promise<FamilyApproach> {
    const existing = await db
      .select()
      .from(familyApproaches)
      .where(eq(familyApproaches.familyId, approach.familyId))
      .limit(1);

    if (existing.length > 0) {
      const [result] = await db
        .update(familyApproaches)
        .set({ ...approach, updatedAt: new Date() })
        .where(eq(familyApproaches.familyId, approach.familyId))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(familyApproaches).values(approach).returning();
      return result;
    }
  }

  async getFamilyApproach(familyId: string): Promise<FamilyApproach | null> {
    const [result] = await db
      .select()
      .from(familyApproaches)
      .where(eq(familyApproaches.familyId, familyId))
      .limit(1);
    return result || null;
  }

  // Child approaches implementation removed - future feature
  // async upsertChildApproach(approach: InsertChildApproach): Promise<ChildApproach> {
  //   const existing = await db
  //     .select()
  //     .from(childApproaches)
  //     .where(eq(childApproaches.childId, approach.childId))
  //     .limit(1);
  //
  //   if (existing.length > 0) {
  //     const [result] = await db
  //       .update(childApproaches)
  //       .set({ ...approach, updatedAt: new Date() })
  //       .where(eq(childApproaches.childId, approach.childId))
  //       .returning();
  //     return result;
  //   } else {
  //     const [result] = await db.insert(childApproaches).values(approach).returning();
  //     return result;
  //   }
  // }
  //
  // async getChildApproach(childId: string): Promise<ChildApproach | null> {
  //   const [result] = await db
  //     .select()
  //     .from(childApproaches)
  //     .where(eq(childApproaches.childId, childId))
  //     .limit(1);
  //   return result || null;
  // }
  //
  // async getChildApproaches(childIds: string[]): Promise<ChildApproach[]> {
  //   if (childIds.length === 0) return [];
  //   return await db
  //     .select()
  //     .from(childApproaches)
  //     .where(inArray(childApproaches.childId, childIds));
  // }
}

export const storage = new DatabaseStorage();
