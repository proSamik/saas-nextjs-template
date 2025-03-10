/*
<ai_context>
This API route handles Stripe webhook events to manage subscription status changes and updates user profiles accordingly.
</ai_context>
*/

import {
  manageSubscriptionStatusChange,
  processStripeCreditsPayment,
  updateStripeCustomer
} from "@/actions/stripe-actions"
import { stripe } from "@/lib/stripe"
import { headers } from "next/headers"
import Stripe from "stripe"

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "payment_intent.succeeded"
])

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  let event: Stripe.Event

  try {
    if (!sig || !webhookSecret) {
      throw new Error("Webhook secret or signature missing")
    }

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await handleSubscriptionChange(event)
          break

        case "checkout.session.completed":
          await handleCheckoutSession(event)
          break

        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event)
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
}

async function handleSubscriptionChange(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const productId = subscription.items.data[0].price.product as string
  await manageSubscriptionStatusChange(
    subscription.id,
    subscription.customer as string,
    productId
  )
}

async function handleCheckoutSession(event: Stripe.Event) {
  const checkoutSession = event.data.object as Stripe.Checkout.Session
  
  if (checkoutSession.mode === "subscription") {
    const subscriptionId = checkoutSession.subscription as string
    await updateStripeCustomer(
      checkoutSession.client_reference_id as string,
      subscriptionId,
      checkoutSession.customer as string
    )

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method"]
    })

    const productId = subscription.items.data[0].price.product as string
    await manageSubscriptionStatusChange(
      subscription.id,
      subscription.customer as string,
      productId
    )
  } else if (checkoutSession.mode === "payment") {
    // This is a one-time payment, likely for credits
    // Check for payment intent
    if (checkoutSession.payment_intent && checkoutSession.client_reference_id) {
      // Get the line items to determine the credits amount
      const lineItems = await stripe.checkout.sessions.listLineItems(checkoutSession.id)
      if (lineItems.data.length > 0) {
        // Get the first line item quantity - this should be the number of credits
        const creditsAmount = lineItems.data[0].quantity || 0

        // Process the credits payment
        await processStripeCreditsPayment(
          checkoutSession.client_reference_id,
          creditsAmount,
          checkoutSession.payment_intent as string
        )
      }
    }
  }
}

async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  
  // Check if this is a payment for credits
  if (paymentIntent.metadata?.type === "credits" && paymentIntent.metadata.userId && paymentIntent.metadata.amount) {
    const userId = paymentIntent.metadata.userId
    const creditsAmount = parseInt(paymentIntent.metadata.amount, 10)
    
    // Process the credits payment
    await processStripeCreditsPayment(
      userId,
      creditsAmount,
      paymentIntent.id
    )
  }
}
