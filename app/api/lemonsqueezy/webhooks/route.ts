/*
<ai_context>
This API route handles LemonSqueezy webhook events to manage subscription status changes and updates user profiles accordingly.
</ai_context>
*/

import {
  manageLemonSqueezySubscriptionStatusChange,
  processLemonSqueezyCreditsPayment,
  updateLemonSqueezyCustomer
} from "@/actions/lemonsqueezy-actions"
import { headers } from "next/headers"
import crypto from "crypto"

// Define the relevant LemonSqueezy webhook events we want to handle
const relevantEvents = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "order_created",
  "order_refunded"
])

export async function POST(req: Request) {
  const body = await req.text()
  // Access headers directly from the request instead
  const signature = req.headers.get("X-Signature") as string
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  try {
    // Verify webhook signature
    if (!signature || !webhookSecret) {
      throw new Error("Webhook secret or signature missing")
    }

    verifySignature(body, signature, webhookSecret)
    const event = JSON.parse(body)

    // Check if this is an event we want to handle
    if (relevantEvents.has(event.meta.event_name)) {
      try {
        switch (event.meta.event_name) {
          case "subscription_created":
          case "subscription_updated":
          case "subscription_cancelled":
          case "subscription_resumed":
          case "subscription_expired":
          case "subscription_paused":
          case "subscription_unpaused":
            await handleSubscriptionChange(event)
            break

          case "order_created":
            await handleOrderCreated(event)
            break
            
          case "order_refunded":
            await handleOrderRefunded(event)
            break

          default:
            throw new Error("Unhandled relevant event!")
        }
      } catch (error) {
        console.error("Webhook handler failed:", error)
        return new Response(
          "Webhook handler failed. View your nextjs function logs.",
          {
            status: 400
          }
        )
      }
    }

    return new Response(JSON.stringify({ received: true }))
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
}

/**
 * Handles subscription changes (created, updated, cancelled, etc.)
 */
async function handleSubscriptionChange(event: any) {
  const subscription = event.data
  const subscriptionId = subscription.id
  const customerId = subscription.attributes.customer_id.toString()
  
  // Determine membership level from product metadata or variant name
  // This should be configured in your LemonSqueezy dashboard
  const membershipLevel = subscription.attributes.variant_name.toLowerCase().includes("pro") 
    ? "pro" 
    : "free"

  await manageLemonSqueezySubscriptionStatusChange(
    subscriptionId,
    customerId,
    membershipLevel as "free" | "pro"
  )
  
  console.log(`Subscription ${event.meta.event_name} processed for customer ${customerId}`)
}

/**
 * Handles new order with subscription or credits
 */
async function handleOrderCreated(event: any) {
  const order = event.data
  const customerId = order.attributes.customer_id.toString()
  const userId = order.attributes.custom_data?.userId || order.attributes.user_id
  
  if (!userId) {
    console.error("No user ID found in order custom data")
    return
  }
  
  // Check if this is a subscription or one-time purchase
  const firstOrderItem = order.attributes.first_order_item
  
  if (firstOrderItem.subscription_id) {
    // This is a subscription purchase
    await updateLemonSqueezyCustomer(
      userId,
      firstOrderItem.subscription_id,
      customerId
    )
  } else {
    // This is likely a credits purchase
    // Check the variant name or product name to determine if it's credits
    const variantName = firstOrderItem.variant_name.toLowerCase()
    
    if (variantName.includes('credit') || variantName.includes('token')) {
      // Determine credits amount from variant name or metadata
      let creditsAmount = 0
      
      // Try to extract amount from variant name (e.g. "10 Credits")
      const match = variantName.match(/(\d+)\s*credits?/i)
      if (match && match[1]) {
        creditsAmount = parseInt(match[1], 10)
      } else {
        // Default amount based on variant ID
        const variantId = firstOrderItem.variant_id.toString()
        if (variantId === process.env.LEMONSQUEEZY_VARIANT_ID_CREDITS_10) {
          creditsAmount = 10
        }
      }
      
      if (creditsAmount > 0) {
        await processLemonSqueezyCreditsPayment(
          userId,
          creditsAmount,
          order.id
        )
      }
    }
  }
}

/**
 * Handles refunded orders
 */
async function handleOrderRefunded(event: any) {
  // You could implement logic to remove credits for refunded orders
  console.log("Order refunded, implement credits removal if needed")
}

/**
 * Verifies the webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret)
  const digest = hmac.update(payload).digest("hex")
  
  if (digest !== signature) {
    throw new Error("Invalid signature")
  }
}
