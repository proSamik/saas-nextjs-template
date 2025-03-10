/*
<ai_context>
This server page displays pricing options for the product, integrating Stripe and LemonSqueezy payment links.
</ai_context>
*/

"use server"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import PaymentProviderSelector from "@/components/payment-provider-selector"
import { auth, currentUser } from "@clerk/nextjs/server"
import { createLemonSqueezyCheckoutSessionAction } from "@/actions/lemonsqueezy-actions"
import { createStripeCheckoutSessionAction } from "@/actions/stripe-actions"
import { PlanType } from "@/lib/stripe"

export default async function PricingPage() {
  const { userId } = await auth()
  const user = await currentUser()
  const userEmail = user?.emailAddresses[0]?.emailAddress

  return (
    <div className="container mx-auto py-12">
      <h1 className="mb-8 text-center text-3xl font-bold">Choose Your Plan</h1>
      <PaymentClientWrapper userId={userId} userEmail={userEmail} />
    </div>
  )
}

// Client-side wrapper component to handle state
"use client"
import { useState } from "react"

interface PaymentClientWrapperProps {
  userId: string | null
  userEmail?: string | null
}

function PaymentClientWrapper({ userId, userEmail }: PaymentClientWrapperProps) {
  const [paymentProvider, setPaymentProvider] = useState<"stripe" | "lemonsqueezy">("stripe")
  const [isLoading, setIsLoading] = useState(false)

  const handleCheckout = async (planType: PlanType) => {
    if (!userId || !userEmail) {
      // Redirect to login or show error message
      alert("Please log in to subscribe")
      return
    }

    setIsLoading(true)
    try {
      if (paymentProvider === "lemonsqueezy") {
        const result = await createLemonSqueezyCheckoutSessionAction(
          userId,
          userEmail,
          planType === "monthly" 
            ? process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY!
            : process.env.LEMONSQUEEZY_VARIANT_ID_YEARLY!
        )

        if (!result.isSuccess) {
          throw new Error(result.message)
        }

        window.location.href = result.data.checkoutUrl
      } else {
        const result = await createStripeCheckoutSessionAction(
          userId,
          userEmail,
          planType
        )

        if (!result.isSuccess) {
          throw new Error(result.message)
        }

        window.location.href = result.data.checkoutUrl
      }
    } catch (error) {
      console.error("Error creating checkout:", error)
      alert("Failed to create checkout session. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <PaymentProviderSelector 
        onSelect={setPaymentProvider}
        defaultProvider="stripe"
      />
      
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <PricingCard
          title="Monthly Plan"
          price="$10"
          description="Billed monthly"
          buttonText={`Subscribe Monthly with ${paymentProvider === "stripe" ? "Stripe" : "LemonSqueezy"}`}
          onClick={() => handleCheckout("monthly")}
          isLoading={isLoading}
        />
        <PricingCard
          title="Yearly Plan"
          price="$100"
          description="Billed annually"
          buttonText={`Subscribe Yearly with ${paymentProvider === "stripe" ? "Stripe" : "LemonSqueezy"}`}
          onClick={() => handleCheckout("yearly")}
          isLoading={isLoading}
        />
      </div>
    </>
  )
}

interface PricingCardProps {
  title: string
  price: string
  description: string
  buttonText: string
  onClick: () => void
  isLoading: boolean
}

function PricingCard({
  title,
  price,
  description,
  buttonText,
  onClick,
  isLoading
}: PricingCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex grow items-center justify-center">
        <p className="text-4xl font-bold">{price}</p>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={onClick}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : buttonText}
        </Button>
      </CardFooter>
    </Card>
  )
}
