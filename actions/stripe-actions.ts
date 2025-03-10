/*
<ai_context>
Contains server actions related to Stripe.
</ai_context>
*/

import {
  updateProfileAction,
  updateProfileByStripeCustomerIdAction
} from "@/actions/db/profiles-actions"
import { SelectProfile } from "@/db/schema"
import { createPlanCheckoutSession, createBillingPortalSession, PlanType, stripe } from "@/lib/stripe"
import { ActionState } from "@/types"
import Stripe from "stripe"

type MembershipStatus = SelectProfile["membership"]

/**
 * Maps Stripe subscription status to app membership status
 */
const getMembershipStatus = (
  status: Stripe.Subscription.Status,
  membership: MembershipStatus
): MembershipStatus => {
  switch (status) {
    case "active":
    case "trialing":
      return membership
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "past_due":
    case "paused":
    case "unpaid":
      return "free"
    default:
      return "free"
  }
}

/**
 * Retrieves a subscription with payment method details
 */
const getSubscription = async (subscriptionId: string) => {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"]
  })
}

/**
 * Creates a checkout session for a Stripe product
 */
export async function createStripeCheckoutSessionAction(
  userId: string,
  userEmail: string,
  planType: PlanType
): Promise<ActionState<{ checkoutUrl: string; checkoutId: string }>> {
  try {
    if (!userId || !userEmail) {
      throw new Error("Missing required parameters for createStripeCheckoutSessionAction")
    }

    const session = await createPlanCheckoutSession({
      planType,
      email: userEmail,
      userId
    })

    return {
      isSuccess: true,
      message: "Checkout session created successfully",
      data: session
    }
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error)
    return {
      isSuccess: false,
      message: "Failed to create checkout session"
    }
  }
}

/**
 * Creates a billing portal session for a Stripe customer
 */
export async function getStripeBillingPortalAction(
  customerId: string
): Promise<ActionState<{ url: string }>> {
  try {
    if (!customerId) {
      throw new Error("Missing required parameter for getStripeBillingPortalAction")
    }

    const portalSession = await createBillingPortalSession(customerId)

    return {
      isSuccess: true,
      message: "Billing portal URL retrieved successfully",
      data: portalSession
    }
  } catch (error) {
    console.error("Error getting Stripe billing portal URL:", error)
    return {
      isSuccess: false,
      message: "Failed to get billing portal URL"
    }
  }
}

/**
 * Updates a user's profile with Stripe customer and subscription IDs
 */
export const updateStripeCustomer = async (
  userId: string,
  subscriptionId: string,
  customerId: string
) => {
  try {
    if (!userId || !subscriptionId || !customerId) {
      throw new Error("Missing required parameters for updateStripeCustomer")
    }

    const subscription = await getSubscription(subscriptionId)

    const result = await updateProfileAction(userId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      paymentProvider: "stripe"
    })

    if (!result.isSuccess) {
      throw new Error("Failed to update customer profile")
    }

    return result.data
  } catch (error) {
    console.error("Error in updateStripeCustomer:", error)
    throw error instanceof Error
      ? error
      : new Error("Failed to update Stripe customer")
  }
}

/**
 * Manages subscription status changes from Stripe webhooks
 */
export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  productId: string
): Promise<MembershipStatus> => {
  try {
    if (!subscriptionId || !customerId || !productId) {
      throw new Error(
        "Missing required parameters for manageSubscriptionStatusChange"
      )
    }

    const subscription = await getSubscription(subscriptionId)
    const product = await stripe.products.retrieve(productId)
    const membership = product.metadata.membership as MembershipStatus

    if (!["free", "pro"].includes(membership)) {
      throw new Error(
        `Invalid membership type in product metadata: ${membership}`
      )
    }

    const membershipStatus = getMembershipStatus(
      subscription.status,
      membership
    )

    const updateResult = await updateProfileByStripeCustomerIdAction(
      customerId,
      {
        stripeSubscriptionId: subscription.id,
        membership: membershipStatus
      }
    )

    if (!updateResult.isSuccess) {
      throw new Error("Failed to update subscription status")
    }

    return membershipStatus
  } catch (error) {
    console.error("Error in manageSubscriptionStatusChange:", error)
    throw error instanceof Error
      ? error
      : new Error("Failed to update subscription status")
  }
}
