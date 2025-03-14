/*
<ai_context>
Defines the database schema for profiles.
</ai_context>
*/

import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const membershipEnum = pgEnum("membership", ["free", "pro"])

// Add payment provider enum
export const paymentProviderEnum = pgEnum("payment_provider", [
  "stripe",
  "lemonsqueezy"
])

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey().notNull(),
  membership: membershipEnum("membership").notNull().default("free"),
  paymentProvider: paymentProviderEnum("payment_provider"),
  // Credits
  credits: integer("credits").default(0).notNull(),
  lastCreditPurchase: timestamp("last_credit_purchase"),
  // Stripe fields
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // LemonSqueezy fields
  lemonSqueezyCustomerId: text("lemonsqueezy_customer_id"),
  lemonSqueezySubscriptionId: text("lemonsqueezy_subscription_id"),
  customerPortalUrl: text("customer_portal_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
})

export type InsertProfile = typeof profilesTable.$inferInsert
export type SelectProfile = typeof profilesTable.$inferSelect
