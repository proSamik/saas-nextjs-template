/*
<ai_context>
Contains server actions related to LemonSqueezy.
</ai_context>
*/

import {
  updateProfileAction,
  updateProfileByLemonSqueezyCustomerIdAction
} from "@/actions/db/profiles-actions"
import { SelectProfile } from "@/db/schema"
import { lemonsqueezy, LemonSqueezySubscription } from "@/lib/lemonsqueezy"
import { ActionState } from "@/types"
import { eq } from "drizzle-orm"
import { db } from "@/db/db"
import { profilesTable } from "@/db/schema"

type MembershipStatus = SelectProfile["membership"]

/**
 * Maps LemonSqueezy subscription status to app membership status
 */
const getMembershipStatus = (
  status: string,
  membership: MembershipStatus
): MembershipStatus => {
  switch (status) {
    case "active":
      return membership
    case "cancelled":
    case "expired":
    case "paused":
    case "past_due":
    case "unpaid":
      return "free"
    default:
      return "free"
  }
}

/**
 * Creates a checkout session for a LemonSqueezy product
 */
export async function createLemonSqueezyCheckoutSessionAction(
  userId: string,
  userEmail: string,
  variantId: string
): Promise<ActionState<{ checkoutUrl: string; checkoutId: string }>> {
  try {
    if (!userId || !userEmail || !variantId) {
      throw new Error("Missing required parameters for createLemonSqueezyCheckoutSessionAction")
    }

    const session = await lemonsqueezy.createCheckoutSession({
      variantId,
      email: userEmail,
      userId
    })

    return {
      isSuccess: true,
      message: "Checkout session created successfully",
      data: session
    }
  } catch (error) {
    console.error("Error creating LemonSqueezy checkout session:", error)
    return {
      isSuccess: false,
      message: "Failed to create checkout session"
    }
  }
}

/**
 * Gets the customer portal URL for a LemonSqueezy customer
 */
export async function getLemonSqueezyCustomerPortalUrlAction(
  customerId: string
): Promise<ActionState<string>> {
  try {
    if (!customerId) {
      throw new Error("Missing required parameter for getLemonSqueezyCustomerPortalUrlAction")
    }

    const portalUrl = await lemonsqueezy.getCustomerPortalUrl(customerId)

    if (!portalUrl) {
      return {
        isSuccess: false,
        message: "Customer portal URL not found"
      }
    }

    return {
      isSuccess: true,
      message: "Customer portal URL retrieved successfully",
      data: portalUrl
    }
  } catch (error) {
    console.error("Error getting LemonSqueezy customer portal URL:", error)
    return {
      isSuccess: false,
      message: "Failed to get customer portal URL"
    }
  }
}

/**
 * Updates a user's profile with LemonSqueezy customer and subscription IDs
 */
export const updateLemonSqueezyCustomer = async (
  userId: string,
  subscriptionId: string,
  customerId: string
) => {
  try {
    if (!userId || !subscriptionId || !customerId) {
      throw new Error("Missing required parameters for updateLemonSqueezyCustomer")
    }

    // Get subscription details
    const subscription = await lemonsqueezy.getSubscription(subscriptionId)

    // Get customer portal URL
    let customerPortalUrl: string | null = null
    try {
      customerPortalUrl = await lemonsqueezy.getCustomerPortalUrl(customerId)
    } catch (error) {
      console.warn("Could not get customer portal URL:", error)
      // Continue without the portal URL
    }

    const result = await updateProfileAction(userId, {
      lemonSqueezyCustomerId: customerId,
      lemonSqueezySubscriptionId: subscriptionId,
      paymentProvider: "lemonsqueezy",
      ...(customerPortalUrl && { customerPortalUrl })
    })

    if (!result.isSuccess) {
      throw new Error("Failed to update customer profile")
    }

    return result.data
  } catch (error) {
    console.error("Error in updateLemonSqueezyCustomer:", error)
    throw error instanceof Error
      ? error
      : new Error("Failed to update LemonSqueezy customer")
  }
}

/**
 * Manages subscription status changes from LemonSqueezy webhooks
 */
export const manageLemonSqueezySubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  membershipLevel: "free" | "pro"
): Promise<MembershipStatus> => {
  try {
    if (!subscriptionId || !customerId) {
      throw new Error(
        "Missing required parameters for manageLemonSqueezySubscriptionStatusChange"
      )
    }

    // Get subscription details
    const subscriptionData = await lemonsqueezy.getSubscription(subscriptionId)
    const subscription = subscriptionData as LemonSqueezySubscription
    
    // Get membership status based on subscription status
    const status = subscription.data.attributes.status
    const membershipStatus = getMembershipStatus(
      status,
      membershipLevel
    )

    // Update the user profile
    const updateResult = await updateProfileByLemonSqueezyCustomerIdAction(
      customerId,
      {
        lemonSqueezySubscriptionId: subscriptionId,
        membership: membershipStatus
      }
    )

    if (!updateResult.isSuccess) {
      throw new Error("Failed to update subscription status")
    }

    return membershipStatus
  } catch (error) {
    console.error("Error in manageLemonSqueezySubscriptionStatusChange:", error)
    throw error instanceof Error
      ? error
      : new Error("Failed to update subscription status")
  }
}

/**
 * Processes a one-time purchase of credits
 */
export async function processLemonSqueezyCreditsPayment(
  userId: string,
  amount: number,
  orderId: string
): Promise<ActionState<SelectProfile>> {
  try {
    if (!userId || !amount || !orderId) {
      throw new Error("Missing required parameters for processLemonSqueezyCreditsPayment")
    }

    // Get the current profile to calculate new credits amount
    const profileResult = await db.query.profiles.findFirst({
      where: eq(profilesTable.userId, userId)
    })

    if (!profileResult) {
      return {
        isSuccess: false,
        message: "User profile not found"
      }
    }

    // Update the user's profile with credits
    const newCredits = (profileResult.credits || 0) + amount
    
    const result = await updateProfileAction(userId, {
      credits: newCredits,
      lastCreditPurchase: new Date(),
      paymentProvider: "lemonsqueezy"
    })

    if (!result.isSuccess) {
      throw new Error("Failed to update user credits")
    }

    return {
      isSuccess: true,
      message: `Successfully added ${amount} credits`,
      data: result.data
    }
  } catch (error) {
    console.error("Error processing LemonSqueezy credits payment:", error)
    return {
      isSuccess: false,
      message: "Failed to process credits payment"
    }
  }
} 