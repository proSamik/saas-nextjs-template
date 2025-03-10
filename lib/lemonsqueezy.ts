/*
<ai_context>
Contains the LemonSqueezy configuration and API client for the app.
</ai_context>
*/

// LemonSqueezy API client setup
// We're using the native fetch API for simplicity, but a dedicated SDK could be used
// once the project becomes more complex

const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY!
const LS_API_URL = "https://api.lemonsqueezy.com/v1"
const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID!

// API client with required headers
const lsApiClient = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${LS_API_URL}${endpoint}`
  const headers = {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${LS_API_KEY}`
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  })

  if (!response.ok) {
    throw new Error(
      `LemonSqueezy API error: ${response.status} ${response.statusText}`
    )
  }

  return response.json()
}

interface CreateCheckoutOptions {
  variantId: string
  email?: string
  userId?: string
  successUrl?: string
  cancelUrl?: string
}

/**
 * Creates a new checkout session
 */
export async function createCheckoutSession({
  variantId,
  email,
  userId,
  successUrl,
  cancelUrl
}: CreateCheckoutOptions) {
  const checkoutData = {
    storeId: parseInt(LS_STORE_ID),
    variantId: parseInt(variantId),
    checkoutData: {
      email,
      custom: {
        userId
      },
      ...(successUrl && { successUrl }),
      ...(cancelUrl && { cancelUrl })
    }
  }

  const response = await lsApiClient('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: checkoutData
      }
    })
  })

  return {
    checkoutUrl: response.data.attributes.url,
    checkoutId: response.data.id
  }
}

/**
 * Retrieve a subscription
 */
export async function getSubscription(subscriptionId: string) {
  return lsApiClient(`/subscriptions/${subscriptionId}`)
}

/**
 * Retrieve customer details
 */
export async function getCustomer(customerId: string) {
  return lsApiClient(`/customers/${customerId}`)
}

/**
 * Get customer portal URL
 */
export async function getCustomerPortalUrl(customerId: string): Promise<string | null> {
  try {
    const customer = await getCustomer(customerId)
    return customer.data.attributes.urls.customer_portal || null
  } catch (error) {
    console.error('Error fetching customer portal URL:', error)
    return null
  }
}

// Define types for LemonSqueezy responses
export interface LemonSqueezySubscription {
  data: {
    id: string
    type: string
    attributes: {
      store_id: number
      customer_id: number
      order_id: number
      order_item_id: number
      product_id: number
      variant_id: number
      product_name: string
      variant_name: string
      status: string // active, cancelled, expired, paused, past_due, unpaid
      status_formatted: string
      user_name: string
      user_email: string
      renewal_price: number
      currency: string
      created_at: string
      updated_at: string
      test_mode: boolean
      urls: {
        update_payment_method: string
      }
      renews_at: string | null
      ends_at: string | null
    }
  }
}

export interface LemonSqueezyCustomer {
  data: {
    id: string
    type: string
    attributes: {
      store_id: number
      name: string
      email: string
      status: string
      city: string | null
      region: string | null
      country: string | null
      total_revenue_currency: string
      mrr: number
      status_formatted: string
      country_formatted: string | null
      total_revenue: number
      created_at: string
      updated_at: string
      test_mode: boolean
      urls: {
        customer_portal: string
      }
    }
  }
}

export const lemonsqueezy = {
  createCheckoutSession,
  getSubscription,
  getCustomer,
  getCustomerPortalUrl
}
