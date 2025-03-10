"use client"

import { Button } from "@/components/ui/button"
import { getLemonSqueezyCustomerPortalUrlAction } from "@/actions/lemonsqueezy-actions"
import { getStripeBillingPortalAction } from "@/actions/stripe-actions"
import { useState } from "react"
import { SelectProfile } from "@/db/schema"

interface CustomerPortalButtonProps {
  profile: SelectProfile
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}

export default function CustomerPortalButton({
  profile,
  variant = "default",
  size = "default"
}: CustomerPortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleBillingPortalAccess = async () => {
    if (!profile) return

    setIsLoading(true)
    try {
      let portalUrl: string | undefined

      // If we already have a portal URL stored (for LemonSqueezy), use it
      if (profile.customerPortalUrl) {
        portalUrl = profile.customerPortalUrl
      } else if (profile.paymentProvider === "stripe" && profile.stripeCustomerId) {
        // For Stripe, generate a portal session
        const result = await getStripeBillingPortalAction(profile.stripeCustomerId)
        if (result.isSuccess) {
          portalUrl = result.data.url
        }
      } else if (profile.paymentProvider === "lemonsqueezy" && profile.lemonSqueezyCustomerId) {
        // For LemonSqueezy, get the portal URL
        const result = await getLemonSqueezyCustomerPortalUrlAction(profile.lemonSqueezyCustomerId)
        if (result.isSuccess) {
          portalUrl = result.data
        }
      }

      if (portalUrl) {
        window.open(portalUrl, "_blank")
      } else {
        alert("Couldn't access billing portal. Please contact support.")
      }
    } catch (error) {
      console.error("Error accessing billing portal:", error)
      alert("An error occurred while accessing the billing portal.")
    } finally {
      setIsLoading(false)
    }
  }

  // Don't render the button if there's no payment provider set
  if (!profile?.paymentProvider) return null

  return (
    <Button 
      onClick={handleBillingPortalAccess} 
      disabled={isLoading} 
      variant={variant}
      size={size}
    >
      {isLoading ? "Loading..." : "Manage Billing"}
    </Button>
  )
} 