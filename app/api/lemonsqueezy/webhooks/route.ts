/*
<ai_context>
This API route handles LemonSqueezy webhook events to manage subscription status changes and updates user profiles accordingly.
</ai_context>
*/

import {
  manageLemonSqueezySubscriptionStatusChange,
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
  "order_created"
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
          case "subscription_resumed":
          case "subscription_unpaused":
            await handleSubscriptionActive(event)
            break
            
          case "subscription_cancelled":
            await handleSubscriptionCancelled(event)
            break
            
          case "subscription_expired":
            await handleSubscriptionExpired(event)
            break
            
          case "subscription_paused":
            await handleSubscriptionPaused(event)
            break

          case "order_created":
            if (event.data.attributes.first_order_item &&
                event.data.attributes.first_order_item.subscription_id) {
              await handleOrderCreated(event)
            }
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
 * Handles active subscription events (created, updated, resumed, unpaused)
 */
async function handleSubscriptionActive(event: any) {
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
 * Handles subscription cancelled event
 */
async function handleSubscriptionCancelled(event: any) {
  const subscription = event.data
  const subscriptionId = subscription.id
  const customerId = subscription.attributes.customer_id.toString()
  
  // When a subscription is cancelled, it remains active until the end of the billing period
  // We'll set it to "free" status only after it expires
  await manageLemonSqueezySubscriptionStatusChange(
    subscriptionId,
    customerId,
    "pro" // Keep as pro until it expires
  )
  
  console.log(`Subscription cancelled for customer ${customerId}`)
}

/**
 * Handles subscription expired event
 */
async function handleSubscriptionExpired(event: any) {
  const subscription = event.data
  const subscriptionId = subscription.id
  const customerId = subscription.attributes.customer_id.toString()
  
  // When a subscription expires, downgrade to free
  await manageLemonSqueezySubscriptionStatusChange(
    subscriptionId,
    customerId,
    "free"
  )
  
  console.log(`Subscription expired for customer ${customerId}`)
}

/**
 * Handles subscription paused event
 */
async function handleSubscriptionPaused(event: any) {
  const subscription = event.data
  const subscriptionId = subscription.id
  const customerId = subscription.attributes.customer_id.toString()
  
  // When a subscription is paused, downgrade to free
  await manageLemonSqueezySubscriptionStatusChange(
    subscriptionId,
    customerId,
    "free"
  )
  
  console.log(`Subscription paused for customer ${customerId}`)
}

/**
 * Handles new order with subscription
 */
async function handleOrderCreated(event: any) {
  const order = event.data
  const customerId = order.attributes.customer_id.toString()
  const userId = order.attributes.custom_data?.userId || order.attributes.user_id
  
  if (!userId) {
    console.error("No user ID found in order custom data")
    return
  }
  
  const subscriptionId = order.attributes.first_order_item.subscription_id

  if (subscriptionId) {
    await updateLemonSqueezyCustomer(
      userId,
      subscriptionId,
      customerId
    )
    
    console.log(`Order created with subscription for user ${userId}, customer ${customerId}`)
  }
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
