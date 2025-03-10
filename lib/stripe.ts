/*
<ai_context>
Contains the Stripe configuration and helper functions for the app.
</ai_context>
*/

import Stripe from "stripe"

// Initialize Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  appInfo: {
    name: "Mckay's App Template",
    version: "0.1.0"
  }
})

// Plan IDs
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY!,
  yearly: process.env.STRIPE_PRICE_ID_YEARLY!,
  credits10: process.env.STRIPE_PRICE_ID_CREDITS_10
} as const

export type PlanInterval = 'monthly' | 'yearly'
export type PlanType = PlanInterval | 'credits'

interface CreateCheckoutOptions {
  priceId: string
  email?: string
  userId?: string
  successUrl?: string
  cancelUrl?: string
  quantity?: number
}

/**
 * Creates a Stripe checkout session
 */
export async function createCheckoutSession({
  priceId,
  email,
  userId,
  successUrl,
  cancelUrl,
  quantity = 1
}: CreateCheckoutOptions): Promise<{ checkoutUrl: string; checkoutId: string }> {
  // Default URLs if not provided
  const defaultSuccessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?success=true`
  const defaultCancelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing?cancelled=true`
  
  const lineItems = [
    {
      price: priceId,
      quantity
    }
  ]
  
  const session = await stripe.checkout.sessions.create({
    mode: priceId === PRICE_IDS.credits10 ? 'payment' as const : 'subscription' as const,
    line_items: lineItems,
    success_url: successUrl || defaultSuccessUrl,
    cancel_url: cancelUrl || defaultCancelUrl,
    client_reference_id: userId || undefined,
    customer_email: email,
    payment_method_types: ['card']
  })

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  return {
    checkoutUrl: session.url,
    checkoutId: session.id
  }
}

/**
 * Creates a Stripe checkout session for a specific plan
 */
export async function createPlanCheckoutSession({
  planType,
  email,
  userId,
  successUrl,
  cancelUrl,
  quantity
}: Omit<CreateCheckoutOptions, 'priceId'> & { planType: PlanType; quantity?: number }) {
  let priceId: string

  switch (planType) {
    case 'monthly':
      priceId = PRICE_IDS.monthly
      break
    case 'yearly':
      priceId = PRICE_IDS.yearly
      break
    case 'credits':
      if (!PRICE_IDS.credits10) {
        throw new Error('Credits plan price ID not configured')
      }
      priceId = PRICE_IDS.credits10
      break
    default:
      throw new Error(`Invalid plan type: ${planType}`)
  }

  return createCheckoutSession({
    priceId,
    email,
    userId,
    successUrl,
    cancelUrl,
    quantity
  })
}

/**
 * Gets the price ID for a specific plan type
 */
export function getPlanPriceId(planType: PlanType): string {
  switch (planType) {
    case 'monthly':
      return PRICE_IDS.monthly
    case 'yearly':
      return PRICE_IDS.yearly
    case 'credits':
      if (!PRICE_IDS.credits10) {
        throw new Error('Credits plan price ID not configured')
      }
      return PRICE_IDS.credits10
    default:
      throw new Error(`Invalid plan type: ${planType}`)
  }
}

/**
 * Creates a billing portal session for a customer
 */
export async function createBillingPortalSession(customerId: string): Promise<{ url: string }> {
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
  })

  return { url: portalSession.url }
}

/**
 * Format cents to dollars with currency symbol
 */
export function formatAmount(amount: number, currency: string = 'usd'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2
  })

  return formatter.format(amount / 100)
}
